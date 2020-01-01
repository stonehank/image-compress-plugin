const imageminPngquant = require('imagemin-pngquant')
const imageminGifsicle = require('imagemin-gifsicle')
const imageminMozjpeg = require('imagemin-mozjpeg')
const imageminSvgo = require('imagemin-svgo')
const tinify = require('tinify')
const path=require('path')
const fileType = require('file-type')
const isSvg = require('is-svg')
const chalk = require('chalk')
const log = console.log
const tinifyPerMonth=500

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

    this.totalSave=0
    this.compressNumber=0
    this.needOptimizeArr=[]

    this.tinifyValidate=[]
    if(this.key){
      this.tinifyValidate.push(new Promise(res=>{
        tinify.key=this.key
        tinify.validate((err) => {
          if (err){
            log(chalk.red('Error with tinify, try again or switch to imagemin.'))
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
      log(chalk.green('Total Save: '+ (this.totalSave / 1024).toFixed(2) + 'KB'))
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
        log(chalk.green(`Finished ${filename}  ${id+1}/${list.length}`))
        log(chalk.blue('Before: ' +(prevSize/1024).toFixed(2)+'KB, After: '+(curSize/1024).toFixed(2) +  'KB, Save: '+((prevSize-curSize) / prevSize *100).toFixed(2)  +'%\n'))
        this.totalSave+=prevSize-curSize
        return this.exec(id+1,list,0)
      })
      .catch(err=>{
        let msg=err || 'Something error happen'
        if(retry<this.retry) {
          log(chalk.yellow(msg+', retrying...('+(retry+1)+')'))
          if(retry===this.retry-1){
            log(chalk.red('Timeout! Try switch another method.'))
          }
          return this.exec(id,list,retry+1)
        }
        log(chalk.red(`Failed : ${filename} ${msg}!\n`))
        return this.exec(id+1,list,0)
      })
  }
  png(buffer,forceImgmin){
    if(this.availableNumber==null && this.key){
      log(chalk.yellow('Waiting for tinify validate...'))
    }
    if(!forceImgmin && this.key){
      return Promise.all(this.tinifyValidate).then(()=>{
        if(this.compressNumber <= this.availableNumber){
          return this._tinify()
        }else{
          log(`Compress method pngquant ---------------- `)
          return imageminPngquant(this.pngquantOpt)(buffer)
        }
      })
    }else{
      log(`Compress method pngquant ---------------- `)
      return imageminPngquant(this.pngquantOpt)(buffer)
    }
  }
  gif(buffer){
    log(`Compress method gifsicle ---------------- `)
    return imageminGifsicle(this.gifsicleOpt)(buffer)
  }
  jpg(buffer,forceImgmin){
    if(!forceImgmin && this.key){
      return Promise.all(this.tinifyValidate).then(()=>{
        if(this.compressNumber <= this.availableNumber){
          return this._tinify()
        }else{
          log(`Compress method mozjpeg ---------------- `)
          return imageminMozjpeg(this.mozjpegOpt)(buffer)
        }
      })
    }else{
      log(`Compress method mozjpeg ---------------- `)
      return imageminMozjpeg(this.mozjpegOpt)(buffer)
    }
  }
  svg(buffer){
    log(`Compress method svgo ---------------- `)
    return imageminSvgo(this.svgoOpt)(buffer)
  }

  _tinify(buffer){
    return new Promise((res,rej)=>{
      log(`Compress method tinify ---------------- `)
      this.compressNumber++
      let source=tinify.fromBuffer(buffer)
      source.toBuffer().then(()=>{
        clearTimeout(this.timer)
        res()
      }).catch(()=>{})
      this.timer=setTimeout(()=>{
        rej('Timeout')
      },this.timeout*1000)
    })
  }
}
module.exports=ImageCompressPlugin
