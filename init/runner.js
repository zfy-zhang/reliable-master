'use strict';

const cluster = require('cluster');

const Web = require('../web');
const Task = require('../core').Task;
const _ = require('../common/utils/helper');

const defaultOpts = require('../common/config').get();
const program = require('commander');

let options = _.clone(defaultOpts);
_.merge(options.server, _.getConfig(program));
options.pkg = require('../package');

/**
 * Created by mac on 2016/10/31.
 */
Web.init(options, () => {
    Task.bind();
});
