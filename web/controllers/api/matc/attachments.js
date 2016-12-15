/**
 * Created by Administrator on 2016/12/9.
 */
var path = require('path');
var fs = require('fs');
const models = require('../../../../common/models');
var crypto = require('crypto');
const Attachment = models.Attachment;

function *getApp() {
    var attachmentId = this.params.attachmentId;
    console.log("参数id:"+attachmentId);
    const attachment = new Attachment();
    const attachmentData = yield attachment.getById(attachmentId);
    var filepath = attachmentData.attachmentAppPath;
    var fileName = attachmentData.attachmentAppName;
    var fileSrc = path.join(filepath,fileName);
    var md5sum = crypto.createHash('md5');
    var str = fs.readFileSync(fileSrc);
    var checkmd5 = md5sum.update(str).digest('hex');
    if(this.query.checkmd5){
        var dataForm = {
            checkmd5:checkmd5,
            fileName:fileName
        }
        return dataForm;
    }else {
        this.res.setHeader('Content-disposition', 'attachment; filename='+fileName);
        return  fs.createReadStream(fileSrc);
    }

}
function *getScript() {
    var attachmentId = this.params.attachmentId;
    console.log("参数id:"+attachmentId);
    const attachment = new Attachment();
    const attachmentData = yield attachment.getById(attachmentId);
    // var filepath = "E:\\macaca\\5848f3acefac666c254f0812\\downLoad.js";
    var filepath = attachmentData.attachmentScriptPath;
    var fileName = attachmentData.attachmentScriptName;
    var fileSrc = path.join(filepath,fileName);
    var md5sum = crypto.createHash('md5');
    var str = fs.readFileSync(fileSrc);
    var checkmd5 = md5sum.update(str).digest('hex');
    if(this.query.checkmd5){
        var dataForm = {
            checkmd5:checkmd5,
            fileName:fileName
        }
        return dataForm;
    }else {
        this.res.setHeader('Content-disposition', 'attachment; filename='+fileName);
        return  fs.createReadStream(fileSrc);
    }
}
function *addTestData() {
    var attachmentId = this.params.attachmentId;
    console.log("参数id:"+attachmentId);
    var path = "E:\\macaca\\5848f3acefac666c254f0812\\downLoad.js";
    var md5sum = crypto.createHash('md5');
    var str = fs.readFileSync(path);
    var checkmd5 = md5sum.update(str).digest('hex');
    return checkmd5;
}
function *dispatch() {

    switch (this.params.method) {
        //获取app文件
        case 'getApp':
            this.body = yield getApp.call(this);
            break;
        //获取脚本文件
        case 'getScript':
            this.body = yield getScript.call(this);
            break;
        case 'addTestData':
            this.body = yield addTestData.call(this);
            break;
    }

}

module.exports = dispatch;