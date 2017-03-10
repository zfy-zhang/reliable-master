'use strict';
const models = require('../../../../common/models');
const _ = require('../../../../common/utils/helper');
const logger = require('../../../../common/utils/logger');
var request = require('request');
var fs = require("fs");
var http = require("http");
var co = require('co');
var Iconv = require('iconv-lite');
let REQUST = require("co-request");
var path = require('path');

const Project = models.Project;
const Device = models.Device;
const Attachment = models.Attachment;
// 提交任务
function* addTask() {
        const project = new Project();
        project.repositoryUrl = _.trim(this.request.body['repositoryUrl']);
        //   project.repositoryUrl = 'https://github.com/xiaomingstudy/macaca-test-sample.git';
        //
        project.repositoryBranch = _.trim(this.request.body['repositoryBranch']);
        //   project.repositoryBranch = 'master';
        var deviceId = _.trim(this.request.body['device_id']);
        const device = new Device();
        var devices = yield device.getById(deviceId);

        project.serialNumber = devices.serialNumber;

        project.resultUrl = _.trim(this.request.body['result_url']);
        project.scriptUrl = _.trim(this.request.body['script_url']);
        project.apkUrl = _.trim(this.request.body['app_url']);
        project.statusUrl = _.trim(this.request.body['job_status_url']);

        project.time = _.moment().format('x');

        project.environment = 'udid=' + project.serialNumber;

        const attachment = new Attachment();

        if (yield project.add()) {
            co(function*() {
                /**
                 * 首先检查是否存在 attachment 目录
                 */
                var tempDir = path.join(__dirname, '..', '..', '..', '..', 'attachment');
                if (!fs.existsSync(tempDir)) {
                    _.mkdir(tempDir);
                }

                /**
                 * 获取脚本文件信息，并且下载脚本文件
                 */
                //发送请求到业务系统
                var scriptResult = yield REQUST.get({ url: project.scriptUrl + '.md5sum' });
                //获取业务系统返回的 md5 值
                var scriptRequestBody = scriptResult.body;
                // var scriptNames = scriptResult.headers['content-disposition'].split('\'')[1];
                var scriptName = 'script.js';

                console.log(scriptName);
                //拼接脚本的路径
                var scriptDir = path.join(tempDir, "script", scriptRequestBody);
                var thisScript = path.join(scriptDir, scriptName);

                if (!fs.existsSync(scriptDir)) {
                    _.mkdir(scriptDir);
                    request(project.scriptUrl).pipe(
                        fs.createWriteStream(thisScript)
                    );
                    //设置 attachment的属性值
                    attachment.attachmentScriptPath = scriptDir;
                    attachment.attachmentScriptName = scriptName;
                } else {
                    attachment.attachmentScriptPath = scriptDir;
                    attachment.attachmentScriptName = scriptName;
                }

                /**
                 * 获取app的md5值，并根据md5值进行判断是否下载app
                 *
                 */
                console.log(project.apkUrl);
                //向业务系统发送请求，请求获取app的md5值
                var appResult = yield REQUST.get({ url: project.apkUrl + '.md5sum' });
                //获取业务系统返回的值
                var appNames1 = appResult.headers['content-disposition'];
                console.log(appNames1);
                var appNames = appResult.headers['content-disposition'].split('\'')[1];
                console.log(appNames);
                var appName = appNames.substring(0, appNames.lastIndexOf("\."));
                console.log(appName);
                var apk = appName.split('\.');
                //由于android和IOS的app后缀名不同，所以分开要区分
                appName = 'app.' + apk[1];
                console.log(appName);
                var requestBody = appResult.body;
                var appDir = path.join(tempDir, "app", requestBody);

                attachment.projectId = project._id;
                if (!fs.existsSync(appDir)) {
                    _.mkdir(appDir);
                    var thisApp = path.join(appDir, appName);
                    request(project.apkUrl).pipe(
                        fs.createWriteStream(thisApp)
                    );
                    attachment.attachmentAppPath = appDir;
                    attachment.attachmentAppName = appName;


                  if(yield attachment.add()){
                    this.body = {
                      success: true,
                      errorMsg: null,
                      data: null
                        };
                    } else {
                      this.body = {
                      success: false,
                      errorMsg: '提交任务失败',
                      data: null
                       };
                    }
            }else{
               attachment.attachmentAppPath=appDir;
               attachment.attachmentAppName=appName;
             if(yield attachment.add()){
               this.body = {
                 success: true,
                 errorMsg: null,
                 data: null
                   };
               } else {
                 this.body = {
                 success: false,
                 errorMsg: '提交任务失败',
                 data: null
                  };
               }
       }

    }).catch(function (err) {
          console.error(err);
      });

  this.body = {
      data:project._id
    };
  } else {
    this.body = {
      success: false,
      errorMsg: '提交任务失败',
      data: null
    };
  }
}
//任务取消
function *cancelTask(){
   this.body = {
      success: true,
      errorMsg: null,
      data: null
    };
}

function *dispatch() {
  switch (this.params.method) {
    case 'add':
      yield addTask.call(this);
      break;
    case 'cancel':
      yield cancelTask.call(this);
      break;

  }
}

module.exports = dispatch;
