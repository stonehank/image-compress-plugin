`Webpack`图片压缩插件

### 概括

`webpack`编译完成后，对图片进行逐个同步压缩，压缩机制使用`imagemin`和`tinify`

### 特点

* 支持`jpg, jpeg, jfif, png, svg, gif`等图片格式
* 支持覆盖或者添加后缀重命名模式
* 支持出错重试，默认最多重试3次
* 支持导出报告文件

### 安装

`npm install image-compress-plugin -D`

### 使用

```js
// webpack.config.js

const ImageCompressPlugin=require('image-compress-plugin')

module.exports={
  plugins:[
    new ImageCompressPlugin()
  ]
}
```

### 参数选项

|参数|默认值|说明|
|:---|:---:|:---|
|key|null|使用`tinify`压缩的API Key|
|overwrite|true|是否覆盖原输出图片(图片源文件不受影响)|
|affix|-cp|如果`overwrite`为true, 那么定义压缩后图片名称后缀|
|pngquant|{}|使用`imagemin-pngquant`压缩`png`的[选项](https://github.com/imagemin/imagemin-pngquant)|
|gifsicle|{colors:64}|使用`imagemin-gifsicle`压缩`gif`[选项](https://github.com/imagemin/imagemin-gifsicle)|
|mozjpeg|{quality: 80}|使用`imagemin-mozjpeg`压缩`jpg,jpeg`等[选项](https://github.com/imagemin/imagemin-mozjpeg)|
|svgo|{}|使用`imagemin-svgo`压缩`svg`[选项](https://github.com/imagemin/imagemin-svgo)|
|timeout|120|压缩无响应最大时间限制，单位(秒)|
|retry|3|压缩失败最多重试次数|
|report|false|是否需要导出压缩报告|
