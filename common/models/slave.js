'use strict';

const mongoose = require('mongoose');

const _ = require('../../common/utils/helper');

const Schema = mongoose.Schema;
const P = mongoose.Promise;
const PAGE_SIZE = 10;

// slave table schema
const Slavechema = new Schema({

    /**
     *slaveUrl=slaveIp:slavePort
     */
    slaveUrl: {
        type: String
    },

    /**
     * slave ip
     */
    slaveIp: {
        type: String
    },

    /**
     * slave port
     */
    slavePort: {
        type: String
    },

    /**
     * 设备状态
     * 1 - > 可用
     * 2 - > 不可用
     */

    status: {
        type: Number,
        default: 1
    },

    /**
     * 错误信息
     */
    errorMessage: {
        type: String
    },


    /**
     * 接入时间
     */

    created_at: {
        type: Date,
        default: Date.now
    },

    /**
     * 更新时间
     */

    updated_at: {
        type: Date,
        default: Date.now
    },

});

Slavechema.index({
    _id: 1,
    create_date: -1
});

Slavechema.methods.add = function () {
    const promise = new P();

    this.save((error, data) => {

        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(null, data);
        }
    });
    return promise;
};

Slavechema.methods.removeById = function (id) {
    const promise = new P();

    Slave.remove({
        _id: id
    }, (error, data) => {

        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(null, data);
        }
    });
    return promise;
};

Slavechema.methods.updateById = function (id, data) {
    const promise = new P();

    Slave.update({
        _id: id
    }, data, {
        upsert: true
    }, (error, data) => {

        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(null, data);
        }
    });
    return promise;
};

/**
 * slave没有的情况下，将所有slaves设置为不可用
 * @param slaveId
 * @param serialNumbers
 * @param data
 * @returns {*}
 */
Slavechema.methods.updateByStatus = function (data) {
    const promise = new P();

    Slave.update({
        status: 1
    }, data, {
        upsert: false
    }, (error, data) => {

        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(null, data);
        }
    });
    return promise;
};

Slavechema.methods.getById = function (id) {
    const promise = new P();

    Slave.findOne({
        _id: id
    }, (error, data) => {

        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(null, data);
        }
    });
    return promise;
};

Slavechema.methods.getByUrl = function (url) {
    const promise = new P();

    Slave.findOne({
        slaveUrl: url
    }, (error, data) => {

        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(null, data);
        }
    });
    return promise;
};


Slavechema.methods.getAll = function (page) {
    const _page = parseInt(page, 10) || 1;
    const promise = new P();

    Slave.find({}, null, {
        skip: PAGE_SIZE * (_page - 1),
        sort: {
            _id: -1
        },
        limit: PAGE_SIZE || Infinity
    }, (error, data) => {

        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(null, data);
        }
    });
    return promise;
};

Slavechema.methods.getTotalCount = function () {
    const promise = new P();

    Slave.count({}, (error, data) => {

        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(null, data);
        }
    });
    return promise;
};

Slavechema.methods.getExpectedOne = function () {
    const promise = new P();

    Slave.findOne({
        status: 0,
        time: {
            $lte: Date.now()
        }
    }, (error, data) => {

        if (error) {
            promise.reject(error);
        } else {
            promise.resolve(null, data);
        }
    });
    return promise;
};

Slavechema.virtual('created_date').get(function () {
    return _.moment(this.created_at).format('YYYY-MM-DD HH:mm:ss');
});

Slavechema.virtual('updated_date').get(function () {
    return _.moment(this.updated_at).format('YYYY-MM-DD HH:mm:ss');
});


mongoose.model('Slave', Slavechema);

const Slave = mongoose.model('Slave');

module.exports = Slave;
