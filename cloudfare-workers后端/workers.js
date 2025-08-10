export default {
    async fetch(request, env, ctx) {
        return new Response('邮件处理Worker运行中', { status: 200 });
    },
  
    async email(message, env, ctx) {
        try {
            console.log('🚀 开始处理邮件');
            console.log('📧 发件人:', message.from, '| 收件人:', message.to);
  
            // 获取原始邮件内容
            const response = new Response(message.raw);
            const arrayBuffer = await response.arrayBuffer();
            const rawText = new TextDecoder().decode(arrayBuffer);
  
            // 显示原始邮件数据
            console.log('📥 === 接收到的原始邮件数据 ===');
            console.log('📏 原始邮件大小:', rawText.length, '字符');
            console.log('📄 原始内容预览:', rawText.substring(0, 500) + '...');
            console.log('📥 === 原始邮件数据结束 ===');
  
            // 分离头部和正文
            const [headers, ...bodyParts] = rawText.split('\r\n\r\n');
            const body = bodyParts.join('\r\n\r\n');
  
            // 解析头部
            const parsedHeaders = this.parseHeaders(headers);
  
            // 解码主题
            const subject = this.decodeSubject(parsedHeaders.subject || '');
  
            // 检查是否为多部分邮件
            const contentType = parsedHeaders['content-type'] || '';
            const isMultipart = contentType.includes('multipart');
  
            console.log('🔍 邮件类型分析:');
            console.log('📄 Content-Type:', contentType);
            console.log('🔄 是否多部分邮件:', isMultipart);
  
            let emailContent = '';
            let htmlContent = '';
  
            if (isMultipart) {
                const result = this.parseMultipartEmail(body, contentType);
                emailContent = result.text;
                htmlContent = result.html;
  
                console.log('📊 多部分解析结果:');
                console.log('📝 纯文本长度:', emailContent.length, '字符');
                console.log('🌐 HTML长度:', htmlContent.length, '字符');
            } else {
                // 单部分邮件
                emailContent = this.decodeContent(body, parsedHeaders);
                console.log('📄 单部分邮件解析完成');
            }
  
            // 如果没有纯文本内容，尝试从HTML中提取
            if (!emailContent && htmlContent) {
                emailContent = this.extractTextFromHtml(htmlContent);
                console.log('🔄 从HTML提取纯文本:', emailContent.length, '字符');
            }
  
            // 显示解析成功的邮件数据
            console.log('✅ === 解析成功的邮件数据 ===');
            console.log('📝 邮件主题:', subject);
            console.log('📧 发件人:', message.from);
            console.log('📧 收件人:', message.to);
            console.log('📄 内容类型:', contentType);
            console.log('🔄 是否多部分:', isMultipart);
            console.log('📏 纯文本长度:', emailContent.length, '字符');
            console.log('🌐 HTML长度:', htmlContent.length, '字符');
            console.log('📄 内容预览:', emailContent.substring(0, 300) + '...');
            console.log('✅ === 邮件数据解析结束 ===');
  
            // 调用UniCloud云函数存储邮件数据
            console.log('☁️ 步骤4: 调用UniCloud云函数存储邮件数据...');
            try {
                await this.callUniCloudFunction(message, subject, emailContent, htmlContent, isMultipart);
                console.log('✅ UniCloud云函数调用成功');
            } catch (cloudFunctionError) {
                console.error('❌ UniCloud云函数调用失败:', cloudFunctionError);
                // 即使云函数调用失败，也不应该让整个邮件处理失败
                console.log('⚠️ 尽管云函数失败，邮件处理继续进行');
            }
  
            console.log('🎯 邮件处理完成');
            return new Response('邮件处理成功', { status: 200 });
  
        } catch (error) {
            console.error('❌ 邮件处理错误:', error);
            console.error('❌ 错误堆栈:', error.stack);
            return new Response('邮件处理失败', { status: 500 });
        }
    },
  
    // 解析邮件头部
    parseHeaders(headers) {
        const parsedHeaders = {};
        const headerLines = headers.split('\r\n');
        let currentHeader = '';
  
        for (const line of headerLines) {
            if (line.match(/^\s/)) {
                // 继续上一个头部
                if (currentHeader) {
                    parsedHeaders[currentHeader] += ' ' + line.trim();
                }
            } else {
                // 新的头部
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    currentHeader = line.substring(0, colonIndex).toLowerCase();
                    parsedHeaders[currentHeader] = line.substring(colonIndex + 1).trim();
                }
            }
        }
  
        return parsedHeaders;
    },
  
    // 解码邮件主题
    decodeSubject(subject) {
        if (!subject) return '';
  
        // 处理 =?charset?encoding?encoded-text?= 格式
        return subject.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (match, charset, encoding, encodedText) => {
            try {
                if (encoding.toUpperCase() === 'Q') {
                    // Quoted-printable
                    return decodeURIComponent(encodedText.replace(/=/g, '%').replace(/_/g, ' '));
                } else if (encoding.toUpperCase() === 'B') {
                    // Base64
                    return atob(encodedText);
                }
            } catch (e) {
                console.warn('主题解码失败:', e);
                return encodedText;
            }
            return match;
        });
    },
  
    // 解析多部分邮件
    parseMultipartEmail(body, contentType) {
        const result = { text: '', html: '' };
  
        try {
            // 提取boundary
            const boundaryMatch = contentType.match(/boundary[=:][\s]*["']?([^"'\s;]+)["']?/i);
            if (!boundaryMatch) {
                console.warn('未找到boundary');
                return result;
            }
  
            const boundary = boundaryMatch[1];
            console.log('🔍 找到boundary:', boundary);
  
            const parts = body.split(`--${boundary}`);
            console.log('📊 分割出', parts.length, '个部分');
  
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i].trim();
                if (!part || part === '--') continue;
  
                console.log(`🔍 处理第${i}部分:`, part.substring(0, 100) + '...');
  
                const [partHeaders, ...contentParts] = part.split('\r\n\r\n');
                if (contentParts.length === 0) continue;
  
                const partContent = contentParts.join('\r\n\r\n');
                const partHeadersLower = partHeaders.toLowerCase();
  
                // 解析部分头部
                const partHeadersObj = this.parseHeaders(partHeaders);
  
                if (partHeadersLower.includes('content-type: text/plain')) {
                    result.text = this.decodeContent(partContent, partHeadersObj);
                    console.log('✅ 找到纯文本部分:', result.text.length, '字符');
                } else if (partHeadersLower.includes('content-type: text/html')) {
                    result.html = this.decodeContent(partContent, partHeadersObj);
                    console.log('✅ 找到HTML部分:', result.html.length, '字符');
                } else if (partHeadersLower.includes('multipart')) {
                    // 嵌套的多部分，递归处理
                    const nestedResult = this.parseMultipartEmail(partContent, partHeaders);
                    if (nestedResult.text) result.text = nestedResult.text;
                    if (nestedResult.html) result.html = nestedResult.html;
                    console.log('🔄 处理嵌套多部分');
                }
            }
        } catch (error) {
            console.error('多部分解析错误:', error);
        }
  
        return result;
    },
  
    // 解码内容
    decodeContent(content, headers) {
        let decoded = content;
  
        const encoding = headers['content-transfer-encoding'] || '';
  
        if (encoding.toLowerCase().includes('quoted-printable')) {
            decoded = decoded
                .replace(/=\r\n/g, '')  // 移除软换行
                .replace(/=([0-9A-F]{2})/gi, (match, hex) => {
                    return String.fromCharCode(parseInt(hex, 16));
                });
        } else if (encoding.toLowerCase().includes('base64')) {
            try {
                decoded = atob(decoded.replace(/\s/g, ''));
            } catch (e) {
                console.warn('Base64解码失败:', e);
            }
        }
  
        return decoded.trim();
    },
  
    // 从HTML中提取纯文本
    extractTextFromHtml(html) {
        return html
            .replace(/<style[^>]*>.*?<\/style>/gis, '')  // 移除样式
            .replace(/<script[^>]*>.*?<\/script>/gis, '') // 移除脚本
            .replace(/<[^>]+>/g, ' ')  // 移除HTML标签
            .replace(/\s+/g, ' ')      // 合并空白字符
            .trim();
    },
  
    // 调用UniCloud云函数存储邮件数据
    async callUniCloudFunction(message, subject, textContent, htmlContent, isMultipart) {
        console.log('☁️ ===== 调用UniCloud云函数 =====');
  
        // 详细记录输入数据状态
        console.log('📊 输入数据摘要:');
        console.log('  - 发件人:', message.from);
        console.log('  - 收件人:', message.to);
        console.log('  - 邮件主题:', subject);
        console.log('  - 是否多部分:', isMultipart);
        console.log('  - 纯文本长度:', textContent.length, '字符');
        console.log('  - HTML长度:', htmlContent.length, '字符');
  
        // 验证输入数据的完整性
        if (!message.from || !message.to) {
            console.error('❌ 邮件基本信息不完整');
            throw new Error('邮件基本信息不完整');
        }
  
        const cloudFunctionUrl = '云函数链接POST_cloudflare_edukg_email';
  
        try {
            // 准备发送给云函数的数据
            console.log('📦 准备payload数据...');
            const payload = this.prepareEmailPayload(message, subject, textContent, htmlContent, isMultipart);
  
            console.log('📦 Payload摘要:');
            console.log('  - 邮件发件人:', payload.emailInfo.from);
            console.log('  - 邮件主题:', payload.emailInfo.subject);
            console.log('  - 邮件类型:', payload.emailInfo.type);
            console.log('  - 内容长度:', payload.emailInfo.contentLength, '字符');
            console.log('  - Payload大小:', JSON.stringify(payload).length, '字符');
  
            // 检查payload大小，避免过大的请求
            const payloadSize = JSON.stringify(payload).length;
            if (payloadSize > 10 * 1024 * 1024) { // 10MB限制
                console.warn('⚠️ Payload大小较大:', Math.round(payloadSize / 1024 / 1024 * 100) / 100, 'MB');
            }
  
            console.log('🚀 发送请求到UniCloud云函数...');
            console.log('🌐 云函数URL:', cloudFunctionUrl);
  
            // 设置请求超时
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
  
            try {
                console.log('📡 发起fetch请求...');
                const response = await fetch(cloudFunctionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Cloudflare-Workers-Email-Processor/1.0',
                        'X-Processing-Timestamp': new Date().toISOString(),
                        'X-Email-Type': isMultipart ? 'multipart' : 'simple',
                        'X-Content-Length': textContent.length.toString()
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
  
                clearTimeout(timeoutId);
  
                console.log('📡 响应状态:', response.status, response.statusText);
  
                // 获取响应头
                const headers = {};
                response.headers.forEach((value, key) => {
                    headers[key] = value;
                });
                console.log('📋 响应头:', headers);
  
                if (response.ok) {
                    console.log('📄 读取响应内容...');
                    const result = await response.json();
                    console.log('✅ UniCloud云函数执行成功!');
                    console.log('📄 响应数据:', JSON.stringify(result, null, 2));
  
                    // 记录处理结果
                    if (result.success) {
                        console.log('🎉 数据处理完成!');
                        if (result.insertedId) {
                            console.log('💾 数据库记录ID:', result.insertedId);
                        }
                        if (result.processingTime) {
                            console.log('⏱️ 处理时间:', result.processingTime, '毫秒');
                        }
                        if (result.message) {
                            console.log('💬 成功消息:', result.message);
                        }
                    } else {
                        console.warn('⚠️ 云函数执行但报告错误:', result.error || '未知错误');
                    }
                } else {
                    console.log('📄 读取错误响应...');
                    const errorText = await response.text();
                    console.error('❌ UniCloud云函数调用失败!');
                    console.error('📋 错误响应:', errorText);
  
                    const errorMessage = this.getDetailedErrorMessage(response.status, errorText);
                    throw new Error(errorMessage);
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
  
                if (fetchError.name === 'AbortError') {
                    console.error('⏰ 请求超时(30秒)');
                    throw new Error('请求超时(30秒)');
                }
                console.error('📡 Fetch错误:', fetchError);
                throw fetchError;
            }
        } catch (error) {
            console.error('❌ 调用UniCloud云函数错误:', error);
            console.error('📋 错误详情:', {
                message: error.message,
                stack: error.stack,
                functionUrl: cloudFunctionUrl,
                emailSubject: subject
            });
            throw error;
        }
    },
  
    // 准备邮件payload数据
    prepareEmailPayload(message, subject, textContent, htmlContent, isMultipart) {
        console.log('📦 开始准备邮件payload...');
  
        // 安全地处理邮件内容
        const safeSubject = this.sanitizeString(subject || '无主题');
        const safeFrom = message.from || '未知发件人';
        const safeTo = message.to || '未知收件人';
  
        // 确定邮件类型
        let emailType = 'text';
        if (isMultipart && htmlContent && textContent) {
            emailType = 'multipart';
        } else if (htmlContent) {
            emailType = 'html';
        }
  
        // 按照云函数期望的格式准备数据
        const payload = {
            // 邮件基本信息
            emailInfo: {
                from: safeFrom,
                to: safeTo,
                subject: safeSubject,
                date: new Date().toISOString(),
                messageId: this.generateMessageId(),
                hasHtml: !!htmlContent,
                hasText: !!textContent
            },
  
            // 邮件内容（云函数期望的格式）
            emailContent: {
                html: htmlContent,
                text: textContent,
                htmlLength: htmlContent.length,
                textLength: textContent.length
            },
  
            // 附件信息（保持兼容性）
            attachment: null,
  
            // DMARC记录（保持兼容性）
            dmarcRecords: [],
  
            // 处理信息
            processedAt: new Date().toISOString(),
            workerInfo: {
                version: '1.0.0',
                source: 'cloudflare-workers-email-parser'
            }
        };
  
        console.log('✅ Payload准备完成（兼容格式）');
        console.log('📊 内容验证:');
        console.log('  - 文本内容长度:', textContent.length);
        console.log('  - HTML内容长度:', htmlContent.length);
        console.log('  - hasText:', !!textContent);
        console.log('  - hasHtml:', !!htmlContent);
        
        return payload;
    },
  
    // 生成消息ID
    generateMessageId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `${timestamp}-${random}@cloudflare-worker`;
    },
  
    // 获取详细错误信息
    getDetailedErrorMessage(status, errorText) {
        switch (status) {
            case 400:
                return `请求参数错误 (400): ${errorText}`;
            case 401:
                return `认证失败 (401): ${errorText}`;
            case 403:
                return `权限不足 (403): ${errorText}`;
            case 404:
                return `云函数未找到 (404): ${errorText}`;
            case 500:
                return `服务器内部错误 (500): ${errorText}`;
            case 502:
                return `网关错误 (502): ${errorText}`;
            case 503:
                return `服务不可用 (503): ${errorText}`;
            case 504:
                return `网关超时 (504): ${errorText}`;
            default:
                return `HTTP错误 (${status}): ${errorText}`;
        }
    },
  
    // 字符串清理函数
    sanitizeString(input) {
        if (!input) return '未知';
  
        try {
            let cleaned = input
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 移除控制字符
                .replace(/[\uFFFD]/g, '?') // 替换替换字符
                .trim();
  
            if (!cleaned) return '未知';
  
            // 限制长度避免日志过长
            if (cleaned.length > 200) {
                cleaned = cleaned.substring(0, 200) + '...';
            }
  
            return cleaned;
        } catch (error) {
            console.warn('⚠️ 字符串清理失败:', error);
            return '编码错误';
        }
    }
  };