'use strict';

// CORS工具函数
class CorsUtils {
    // 获取请求来源
    static getOrigin(headers) {
        return headers?.origin || headers?.Origin || '*';
    }

    // 设置CORS响应头
    static setCorsHeaders(origin, additionalHeaders = {}) {
        return {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
            ...additionalHeaders
        };
    }

    // 处理OPTIONS预检请求
    static handleOptionsRequest(headers) {
        const origin = this.getOrigin(headers);
        return {
            statusCode: 200,
            headers: this.setCorsHeaders(origin),
            body: JSON.stringify({ message: 'OK' })
        };
    }

    // 创建成功响应
    static successResponse(data, headers) {
        const origin = this.getOrigin(headers);
        return {
            statusCode: 200,
            headers: this.setCorsHeaders(origin),
            body: JSON.stringify(data)
        };
    }

    // 创建错误响应
    static errorResponse(error, statusCode = 500, headers) {
        const origin = this.getOrigin(headers);
        return {
            statusCode: statusCode,
            headers: this.setCorsHeaders(origin),
            body: JSON.stringify({
                success: false,
                error: error.message || error
            })
        };
    }

    // 验证HTTP方法
    static validateMethod(httpMethod, allowedMethods = ['POST']) {
        return allowedMethods.includes(httpMethod);
    }

    // 解析请求体
    static parseBody(body) {
        try {
            return typeof body === 'string' ? JSON.parse(body) : body;
        } catch (error) {
            throw new Error('无效的请求体格式');
        }
    }
}

exports.main = async (event, context) => {
    console.log('=== GET_cloudflare_edukg_email 云函数开始执行 ===');
    console.log('接收到的事件参数:', JSON.stringify(event, null, 2));

    try {
        // 解析HTTP请求
        const { httpMethod, body, headers } = event;

        // 处理OPTIONS预检请求
        if (httpMethod === 'OPTIONS') {
            console.log('处理OPTIONS预检请求');
            return CorsUtils.handleOptionsRequest(headers);
        }

        // 验证HTTP方法
        if (!CorsUtils.validateMethod(httpMethod, ['POST'])) {
            console.log('HTTP方法不允许:', httpMethod);
            return CorsUtils.errorResponse('方法不允许', 405, headers);
        }

        // 解析请求体
        let requestData;
        try {
            requestData = CorsUtils.parseBody(body) || event;
        } catch (parseError) {
            console.error('请求体解析失败:', parseError);
            return CorsUtils.errorResponse(parseError, 400, headers);
        }

        const { email } = requestData;

        if (!email) {
            console.error('缺少必需的参数: email');
            return {
                success: false,
                error: '缺少邮箱地址参数'
            };
        }

        console.log('查询邮箱:', email);

        // 获取数据库引用
        const db = uniCloud.database();
        const collection = db.collection('cloudflare_edukg_email');

        // 首先检查集合是否存在以及总数据量
        console.log('=== 开始数据库调试 ===');
        try {
            const countResult = await collection.count();
            console.log('数据库集合总记录数:', countResult.total);

            // 获取前几条记录看看数据结构
            const sampleResult = await collection.limit(3).get();
            console.log('数据库样本数据:', JSON.stringify(sampleResult.data, null, 2));

            // 检查是否有该邮箱的任何记录（不限制条件）
            const allEmailResult = await collection
                .where({
                    emailTo: email
                })
                .get();
            console.log(`邮箱 ${email} 的所有记录数:`, allEmailResult.data.length);
            console.log(`邮箱 ${email} 的所有记录:`, JSON.stringify(allEmailResult.data, null, 2));

            // 尝试模糊匹配
            const fuzzyResult = await collection
                .where({
                    emailTo: db.RegExp({
                        regexp: email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                        options: 'i'
                    })
                })
                .get();
            console.log(`邮箱 ${email} 的模糊匹配记录数:`, fuzzyResult.data.length);

        } catch (debugError) {
            console.error('数据库调试查询失败:', debugError);
        }

        // 尝试多种排序方式查询该邮箱的最新一条消息
        let result;

        // 方式1：按emailDate排序
        try {
            result = await collection
                .where({
                    emailTo: email
                })
                .orderBy('emailDate', 'desc')
                .limit(1)
                .get();
            console.log('按emailDate排序的查询结果:', result.data.length);
        } catch (sortError) {
            console.log('按emailDate排序失败:', sortError.message);
        }

        // 如果方式1没有结果，尝试方式2：按createTime排序
        if (!result || !result.data || result.data.length === 0) {
            try {
                result = await collection
                    .where({
                        emailTo: email
                    })
                    .orderBy('createTime', 'desc')
                    .limit(1)
                    .get();
                console.log('按createTime排序的查询结果:', result.data.length);
            } catch (sortError) {
                console.log('按createTime排序失败:', sortError.message);
            }
        }

        // 如果方式2也没有结果，尝试方式3：不排序，直接查询
        if (!result || !result.data || result.data.length === 0) {
            try {
                result = await collection
                    .where({
                        emailTo: email
                    })
                    .limit(1)
                    .get();
                console.log('不排序的查询结果:', result.data.length);
            } catch (sortError) {
                console.log('不排序查询失败:', sortError.message);
            }
        }

        console.log('数据库查询结果:', JSON.stringify(result, null, 2));
        console.log('查询结果数据长度:', result.data ? result.data.length : 0);

        if (result.data && result.data.length > 0) {
            const latestEmail = result.data[0];
            console.log('找到最新邮件:', JSON.stringify(latestEmail, null, 2));

            const responseData = {
                success: true,
                message: '成功获取最新邮件',
                data: latestEmail
            };

            console.log('准备返回成功响应:', JSON.stringify(responseData, null, 2));
            console.log('=== 云函数执行成功 ===');

            return CorsUtils.successResponse(responseData, headers);
        } else {
            console.log('未找到该邮箱的邮件');

            const responseData = {
                success: false,
                message: '暂无邮件',
                data: null
            };

            console.log('准备返回无邮件响应:', JSON.stringify(responseData, null, 2));
            return CorsUtils.successResponse(responseData, headers);
        }

    } catch (error) {
        console.error('=== GET_cloudflare_edukg_email 云函数执行失败 ===');
        console.error('错误详情:', error);
        console.error('错误堆栈:', error.stack);

        // 确保headers变量可用
        const headers = event?.headers || {};
        return CorsUtils.errorResponse(error, 500, headers);
    }
};