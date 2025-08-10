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
    console.log('=== POST_cloudflare_edukg_email 云函数开始执行 ===');
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
        let emailData;
        try {
            emailData = CorsUtils.parseBody(body) || event;
        } catch (parseError) {
            console.error('请求体解析失败:', parseError);
            return CorsUtils.errorResponse(parseError, 400, headers);
        }

        console.log('解析后的邮件数据:', JSON.stringify(emailData, null, 2));

        // 验证邮件数据结构
        const { emailInfo, emailContent } = emailData;
        
        if (!emailInfo || !emailContent) {
            console.error('邮件数据格式错误 - 缺少必要字段');
            return CorsUtils.errorResponse('邮件数据格式错误', 400, headers);
        }

        // 验证必要的邮件信息
        if (!emailInfo.from || !emailInfo.to) {
            console.error('邮件基本信息不完整');
            return CorsUtils.errorResponse('邮件基本信息不完整', 400, headers);
        }

        console.log('=== 开始保存邮件到数据库 ===');
        console.log('邮件发件人:', emailInfo.from);
        console.log('邮件收件人:', emailInfo.to);
        console.log('邮件主题:', emailInfo.subject);
        console.log('邮件类型:', emailInfo.hasHtml ? 'HTML' : '纯文本');
        console.log('文本内容长度:', emailContent.text ? emailContent.text.length : 0);
        console.log('HTML内容长度:', emailContent.html ? emailContent.html.length : 0);

        // 获取数据库引用
        const db = uniCloud.database();
        
        // 准备保存的数据
        const emailRecord = {
            // 基本邮件信息
            emailFrom: emailInfo.from,
            emailTo: emailInfo.to,
            emailSubject: emailInfo.subject || '无主题',
            emailDate: emailInfo.date || new Date().toISOString(),
            
            // 邮件内容
            emailText: emailContent.text || '',
            emailHtml: emailContent.html || '',
            
            // 邮件类型和状态
            emailType: emailInfo.hasHtml ? 'html' : 'text',
            hasHtml: emailInfo.hasHtml || false,
            hasText: !!emailContent.text,
            
            // 内容长度统计
            textLength: emailContent.text ? emailContent.text.length : 0,
            htmlLength: emailContent.html ? emailContent.html.length : 0,
            
            // 处理信息
            createTime: Date.now(),
            processedAt: new Date().toISOString(),
            
            // Worker 信息
            workerInfo: emailData.workerInfo || {
                version: '1.0.0',
                source: 'cloudflare-workers-email-parser'
            }
        };

        console.log('准备保存的邮件记录:', JSON.stringify(emailRecord, null, 2));

        try {
            // 保存到数据库
            const result = await db.collection('cloudflare_edukg_email').add(emailRecord);
            
            console.log('✅ 邮件保存成功');
            console.log('数据库插入结果:', JSON.stringify(result, null, 2));

            // 统计信息
            const stats = {
                insertedId: result.id,
                emailFrom: emailInfo.from,
                emailTo: emailInfo.to,
                subject: emailInfo.subject,
                contentType: emailInfo.hasHtml ? 'html' : 'text',
                textLength: emailContent.text ? emailContent.text.length : 0,
                htmlLength: emailContent.html ? emailContent.html.length : 0,
                processingTime: Date.now() - (emailData.startTime || Date.now())
            };

            const responseData = {
                success: true,
                message: '邮件保存成功',
                insertedId: result.id,
                stats: stats,
                timestamp: new Date().toISOString()
            };

            console.log('准备返回成功响应:', JSON.stringify(responseData, null, 2));
            console.log('=== 云函数执行成功 ===');

            return CorsUtils.successResponse(responseData, headers);

        } catch (dbError) {
            console.error('=== 数据库操作失败 ===');
            console.error('数据库错误详情:', dbError);
            console.error('错误类型:', dbError.constructor.name);
            console.error('错误消息:', dbError.message);
            
            // 检查是否是集合不存在的错误
            if (dbError.error === -407 || dbError.errorMessage?.includes('not found collection')) {
                console.log('数据库集合不存在，尝试创建...');
                try {
                    // 尝试再次插入，这会自动创建集合
                    const retryResult = await db.collection('cloudflare_edukg_email').add(emailRecord);
                    console.log('✅ 集合创建成功，邮件保存成功');
                    
                    const responseData = {
                        success: true,
                        message: '邮件保存成功（集合已自动创建）',
                        insertedId: retryResult.id,
                        timestamp: new Date().toISOString()
                    };
                    
                    return CorsUtils.successResponse(responseData, headers);
                } catch (retryError) {
                    console.error('重试插入也失败:', retryError);
                    throw retryError;
                }
            } else {
                throw dbError;
            }
        }

    } catch (error) {
        console.error('=== POST_cloudflare_edukg_email 云函数执行失败 ===');
        console.error('错误详情:', error);
        console.error('错误堆栈:', error.stack);
        console.error('错误类型:', error.constructor.name);

        // 确保headers变量可用
        const headers = event?.headers || {};
        return CorsUtils.errorResponse(error, 500, headers);
    }
};