const imageminPngquant = require('imagemin-pngquant')
const imageminGifsicle = require('imagemin-gifsicle')
const imageminMozjpeg = require('imagemin-mozjpeg')
const imageminSvgo = require('imagemin-svgo')
const tinify = require('tinify')
const path=require('path')
const fs=require('fs-extra')
const fileType = require('file-type')
const isSvg = require('is-svg')
const chalk = require('chalk')
const log = console.log
const tinifyPerMonth=500
const reportFilename='image-compress-report.txt'
let outputPath='/'+reportFilename

class ImageCompressPlugin{
  constructor({
                key='', // For use tinify compress
                overwrite=true,
                affix='-cp',
                pngquant={},
                gifsicle={colors:64},
                mozjpeg={quality: 80},
                svgo={},
                timeout=120,
                retry=3,
                report=false
              }={}){
    this.overwrite=overwrite
    this.affix=affix
    this.key=key
    this.retry=retry
    this.timeout=timeout
    this.pngquantOpt=pngquant
    this.gifsicleOpt=gifsicle
    this.mozjpegOpt=mozjpeg
    this.svgoOpt=svgo
    this.report=report

    this.totalSave=0
    this.compressNumber=0
    this.needOptimizeArr=[]

    this.tinifyValidate=[]
    if(this.key){
      this.tinifyValidate.push(new Promise(res=>{
        tinify.key=this.key
        tinify.validate((err) => {
          if (err){
            this.echo('Error with tinify, try again or switch to imagemin.','red')
            throw err
          }
          this.availableNumber=tinifyPerMonth-tinify.compressionCount
          res()
        })
      }))
    }
  }

  isValidImage(filename,source){
    let type=null
    let buffer=null
    try{
      buffer=Buffer.from(source)
      type=fileType(buffer)
    }catch(_){}
    let ext=type ? type.ext : null
    if(ext==='png'){
      return 'png'
    }else if(ext==='jpg'){
      return 'jpg'
    }else if(ext==='gif'){
      return 'gif'
    }else {
      return buffer && isSvg(buffer) ? 'svg' : false
    }
  }

  apply(compiler) {
    compiler.hooks.emit.tap(this.constructor.name, compilation => {
      try{
        outputPath=path.resolve(compilation.outputOptions.path,reportFilename)
      }catch(_){}
      fs.outputFileSync(outputPath,'')
      for(let filename in compilation.assets){
        if(compilation.assets.hasOwnProperty(filename)){
          if(compilation.assets[filename].constructor.name==='RawSource'){
            let ext=this.isValidImage(filename,compilation.assets[filename]._value)
            if(ext){
              if(!this.overwrite){
                let nameParse=path.parse(filename)
                let nameStr=nameParse.name
                let nameExt=nameParse.ext
                let nameDir=nameParse.dir
                let newFilename=nameDir+'/'+nameStr+this.affix+nameExt
                let RawSource=compilation.assets[filename].constructor
                compilation.assets[newFilename]=new RawSource(compilation.assets[filename]._value)
                this.needOptimizeArr.push({
                  obj:compilation.assets[newFilename],
                  filename:newFilename,
                  ext,
                })
              }else{
                this.needOptimizeArr.push({
                  obj:compilation.assets[filename],
                  filename,
                  ext,
                })
              }
            }
          }
        }
      }
      this.exec(0,this.needOptimizeArr,0)
    })
  }
  exec(id,list,retry){
    if(id===list.length){
      this.echo('Total Save: '+ this.appropriateSizeUnit(this.totalSave / 1024),'green')
      if(this.key){
        this.echo('Your tinify available compress count:'+(this.availableNumber-this.compressNumber) ,'green')
      }
      return Promise.resolve()
    }
    let resouceObj=list[id].obj
    let resourceExt=list[id].ext
    let filename=list[id].filename
    let prevSize=Buffer.byteLength(resouceObj._value)
    return this[resourceExt](resouceObj._value,retry>=this.retry)
      .then((buffer) => {
        resouceObj._value=buffer
        let curSize=Buffer.byteLength(buffer)
        this.echo(`Finished ${filename}  ${id+1}/${list.length}`,'green')
        this.echo('Before: ' +this.appropriateSizeUnit(prevSize/1024)+', After: '+this.appropriateSizeUnit(curSize/1024) +  ', Save: '+((prevSize-curSize) / prevSize *100).toFixed(2)  +'%\n','blue')
        this.totalSave+=prevSize-curSize
        return this.exec(id+1,list,0)
      })
      .catch(err=>{
        let msg=err || 'Something error happen'
        if(retry<this.retry) {
          this.echo(msg+', retrying...('+(retry+1)+')','yellow')
          if(retry===this.retry-1){
            this.echo('Timeout! Try switch another method.','red')
          }
          return this.exec(id,list,retry+1)
        }
        this.echo(`Failed : ${filename} ${msg}!\n`,'red')
        return this.exec(id+1,list,0)
      })
  }
  png(buffer,forceImgmin){
    if(this.availableNumber==null && this.key){
      this.echo('Waiting for tinify validate...','yellow')
    }
    if(!forceImgmin && this.key){
      return Promise.all(this.tinifyValidate).then(()=>{
        if(this.compressNumber <= this.availableNumber){
          return this._tinify(buffer)
        }else{
          this.echo('Tinify monthly limit! Switch to compress method pngquant ---------------- ')
          return imageminPngquant(this.pngquantOpt)(buffer)
        }
      })
    }else{
      this.echo('Compress method pngquant ---------------- ')
      return imageminPngquant(this.pngquantOpt)(buffer)
    }
  }
  gif(buffer){
    this.echo('Compress method gifsicle ---------------- ')
    return imageminGifsicle(this.gifsicleOpt)(buffer)
  }
  jpg(buffer,forceImgmin){
    if(!forceImgmin && this.key){
      return Promise.all(this.tinifyValidate).then(()=>{
        if(this.compressNumber <= this.availableNumber){
          return this._tinify(buffer)
        }else{
          this.echo('Tinify monthly limit!Switch to compress method mozjpeg ---------------- ')
          return imageminMozjpeg(this.mozjpegOpt)(buffer)
        }
      })
    }else{
      this.echo('Compress method mozjpeg ---------------- ')
      return imageminMozjpeg(this.mozjpegOpt)(buffer)
    }
  }
  svg(buffer){
    this.echo('Compress method svgo ---------------- ')
    return imageminSvgo(this.svgoOpt)(buffer)
  }

  _tinify(buffer){
    return new Promise((res,rej)=>{
      this.echo('Compress method tinify ---------------- ')
      this.compressNumber++
      let source=tinify.fromBuffer(buffer)
      source.toBuffer().then((buffer)=>{
        clearTimeout(this.timer)
        res(buffer)
      }).catch(()=>{})
      this.timer=setTimeout(()=>{
        rej('Timeout')
      },this.timeout*1000)
    })
  }
  appropriateSizeUnit(num){
    if(num<1024){
      return num.toFixed(2)+'KB'
    }else{
      return (num/1024).toFixed(2)+'MB'
    }
  }
  echo(msg,color){
    if(this.report){
      fs.outputFileSync(outputPath,'\n'+msg,{flag:'a+'})
    }
    log(color ? chalk[color](msg) : msg)
  }
}
module.exports=ImageCompressPlugin
