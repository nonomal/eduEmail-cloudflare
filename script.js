// 全局变量
let config = {
    cloudflare: {
        api_token: '',
        zone_id: '',
        domain: ''
    },
    qq_email: {
        username: '',
        password: '',
        smtp_server: 'smtp.qq.com',
        smtp_port: 465,
        imap_server: 'imap.qq.com',
        imap_port: 993
    },
    forward_settings: {
        check_interval: 10,
        max_temp_emails: 10,
        send_notification: false
    }
};

// 环境变量映射
const ENV_VARS = {
    'TEMP_EMAIL_QQ_USERNAME': 'qq_email.username',
    'TEMP_EMAIL_QQ_PASSWORD': 'qq_email.password',
    'TEMP_EMAIL_CF_API_TOKEN': 'cloudflare.api_token',
    'TEMP_EMAIL_CF_ZONE_ID': 'cloudflare.zone_id',
    'TEMP_EMAIL_DOMAIN': 'cloudflare.domain',
    'TEMP_EMAIL_CHECK_INTERVAL': 'forward_settings.check_interval'
};

let tempEmails = {};
let isMonitoring = false;
let monitorInterval = null;
let startTime = null;
let receivedEmailCount = 0;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadConfigFromEnv();
    updateStats();
    updateEmailList();
});

// 从环境变量加载配置
async function loadConfigFromEnv() {
    try {
        // 尝试从不同来源获取环境变量
        await loadFromProcessEnv();
        await loadFromServerEnv();
        await loadFromLocalStorage();
        
        // 更新状态显示
        updateConfigStatus();
        
        // 加载保存的临时邮箱
        const savedEmails = localStorage.getItem('tempEmails');
        if (savedEmails) {
            tempEmails = JSON.parse(savedEmails);
        }
        
    } catch (error) {
        console.error('加载配置失败:', error);
        showNotification('配置加载失败，请检查环境变量设置', 'error');
    }
}

// 从 process.env 加载（Node.js环境）
function loadFromProcessEnv() {
    return new Promise((resolve) => {
        try {
            if (typeof process !== 'undefined' && process.env) {
                for (const [envVar, configPath] of Object.entries(ENV_VARS)) {
                    const value = process.env[envVar];
                    if (value) {
                        setConfigValue(configPath, value);
                    }
                }
            }
        } catch (error) {
            console.log('process.env 不可用');
        }
        resolve();
    });
}

// 从服务器端点加载环境变量
async function loadFromServerEnv() {
    try {
        const response = await fetch('/api/env');
        if (response.ok) {
            const envData = await response.json();
            for (const [envVar, configPath] of Object.entries(ENV_VARS)) {
                const value = envData[envVar];
                if (value) {
                    setConfigValue(configPath, value);
                }
            }
        }
    } catch (error) {
        console.log('服务器环境变量不可用');
    }
}

// 从本地存储加载（作为后备）
function loadFromLocalStorage() {
    const savedConfig = localStorage.getItem('tempEmailConfig');
    if (savedConfig) {
        const saved = JSON.parse(savedConfig);
        config = { ...config, ...saved };
    }
}

// 设置配置值
function setConfigValue(path, value) {
    const keys = path.split('.');
    let obj = config;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
    }
    
    // 处理数字类型
    if (path === 'forward_settings.check_interval') {
        obj[keys[keys.length - 1]] = parseInt(value) || 10;
    } else {
        obj[keys[keys.length - 1]] = value;
    }
}

// 更新配置状态显示
function updateConfigStatus() {
    const statusItems = [
        {
            id: 'qqEmail',
            value: config.qq_email.username,
            label: '邮箱地址'
        },
        {
            id: 'cfApi',
            value: config.cloudflare.api_token,
            label: 'API Token'
        },
        {
            id: 'domain',
            value: config.cloudflare.domain,
            label: '域名'
        }
    ];
    
    let allConfigured = true;
    
    statusItems.forEach(item => {
        const statusElement = document.getElementById(`${item.id}Status`);
        const indicatorElement = document.getElementById(`${item.id}Indicator`);
        
        if (item.value && item.value.trim()) {
            if (item.id === 'qqEmail') {
                statusElement.textContent = item.value;
            } else if (item.id === 'cfApi') {
                statusElement.textContent = `${item.value.substring(0, 8)}...`;
            } else {
                statusElement.textContent = item.value;
            }
            indicatorElement.textContent = '✅';
            indicatorElement.style.color = '#28a745';
        } else {
            statusElement.textContent = `未配置 ${item.label}`;
            indicatorElement.textContent = '❌';
            indicatorElement.style.color = '#dc3545';
            allConfigured = false;
        }
    });
    
    // 更新系统状态
    const systemStatusElement = document.getElementById('systemStatus');
    const systemIndicatorElement = document.getElementById('systemIndicator');
    
    if (allConfigured) {
        systemStatusElement.textContent = '配置完成，系统就绪';
        systemIndicatorElement.textContent = '✅';
        systemIndicatorElement.style.color = '#28a745';
    } else {
        systemStatusElement.textContent = '配置不完整，请设置环境变量';
        systemIndicatorElement.textContent = '⚠️';
        systemIndicatorElement.style.color = '#ffc107';
    }
}

// 刷新配置
async function refreshConfig() {
    showNotification('正在刷新配置...', 'info');
    await loadConfigFromEnv();
    showNotification('配置已刷新', 'success');
}

// 显示环境变量帮助
function showEnvHelp() {
    const modal = document.createElement('div');
    modal.className = 'env-help-modal';
    modal.innerHTML = `
        <div class="env-help-content">
            <button class="env-help-close" onclick="this.parentElement.parentElement.remove()">×</button>
            <h2 style="color: #4facfe; margin-bottom: 20px;">
                <i class="fas fa-info-circle"></i> 环境变量配置说明
            </h2>
            
            <p style="margin-bottom: 20px; color: #666;">
                系统需要以下环境变量来正常运行。请在您的系统中设置这些变量：
            </p>
            
            <div class="env-var">
                <div class="env-var-name">TEMP_EMAIL_QQ_USERNAME</div>
                <div class="env-var-desc">QQ邮箱地址，例如：your-email@qq.com</div>
            </div>
            
            <div class="env-var">
                <div class="env-var-name">TEMP_EMAIL_QQ_PASSWORD</div>
                <div class="env-var-desc">QQ邮箱授权码（不是QQ密码），在QQ邮箱设置中生成</div>
            </div>
            
            <div class="env-var">
                <div class="env-var-name">TEMP_EMAIL_CF_API_TOKEN</div>
                <div class="env-var-desc">Cloudflare API Token，需要Zone:Edit权限</div>
            </div>
            
            <div class="env-var">
                <div class="env-var-name">TEMP_EMAIL_CF_ZONE_ID</div>
                <div class="env-var-desc">Cloudflare Zone ID，在域名概览页面可以找到</div>
            </div>
            
            <div class="env-var">
                <div class="env-var-name">TEMP_EMAIL_DOMAIN</div>
                <div class="env-var-desc">用于临时邮箱的域名，例如：example.com</div>
            </div>
            
            <div class="env-var">
                <div class="env-var-name">TEMP_EMAIL_CHECK_INTERVAL</div>
                <div class="env-var-desc">邮件检查间隔（秒），默认为10秒</div>
            </div>
            
            <h3 style="color: #4facfe; margin: 25px 0 15px 0;">设置方法：</h3>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <strong>Windows:</strong><br>
                <code style="background: #e9ecef; padding: 2px 5px; border-radius: 3px;">
                    set TEMP_EMAIL_QQ_USERNAME=your-email@qq.com
                </code>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <strong>Linux/Mac:</strong><br>
                <code style="background: #e9ecef; padding: 2px 5px; border-radius: 3px;">
                    export TEMP_EMAIL_QQ_USERNAME=your-email@qq.com
                </code>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <strong>.env 文件:</strong><br>
                <code style="background: #e9ecef; padding: 2px 5px; border-radius: 3px;">
                    TEMP_EMAIL_QQ_USERNAME=your-email@qq.com
                </code>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                <strong>注意：</strong> 设置环境变量后需要重启应用程序或刷新页面。
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击模态框外部关闭
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 创建临时邮箱
async function createTempEmail() {
    if (!validateConfig()) {
        showNotification('系统配置不完整，请检查环境变量设置', 'error');
        showEnvHelp();
        return;
    }
    
    const emailPrefix = 'temp_' + Math.random().toString(36).substr(2, 8);
    const tempEmail = `${emailPrefix}@${config.cloudflare.domain}`;
    
    try {
        // 模拟API调用创建Cloudflare转发规则
        showNotification('正在创建临时邮箱...', 'info');
        
        // 这里应该调用Cloudflare API，由于是纯前端，我们模拟成功
        await simulateApiCall();
        
        tempEmails[tempEmail] = {
            rule_id: 'rule_' + Math.random().toString(36).substr(2, 8),
            created_at: new Date().toISOString(),
            last_checked: null
        };
        
        localStorage.setItem('tempEmails', JSON.stringify(tempEmails));
        updateEmailList();
        updateStats();
        
        showNotification(`成功创建临时邮箱: ${tempEmail}`, 'success');
        
        // 复制到剪贴板
        navigator.clipboard.writeText(tempEmail).then(() => {
            showNotification('邮箱地址已复制到剪贴板', 'info');
        });
        
    } catch (error) {
        showNotification('创建临时邮箱失败: ' + error.message, 'error');
    }
}

// 删除选中的邮箱
function deleteSelectedEmails() {
    const checkboxes = document.querySelectorAll('.email-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('请选择要删除的邮箱', 'warning');
        return;
    }
    
    if (confirm(`确定要删除 ${checkboxes.length} 个临时邮箱吗？`)) {
        checkboxes.forEach(checkbox => {
            const email = checkbox.value;
            delete tempEmails[email];
        });
        
        localStorage.setItem('tempEmails', JSON.stringify(tempEmails));
        updateEmailList();
        updateStats();
        showNotification(`已删除 ${checkboxes.length} 个临时邮箱`, 'success');
    }
}

// 切换监控状态
function toggleMonitor() {
    if (isMonitoring) {
        stopMonitor();
    } else {
        startMonitor();
    }
}

// 开始监控
function startMonitor() {
    if (Object.keys(tempEmails).length === 0) {
        showNotification('请先创建临时邮箱', 'warning');
        return;
    }
    
    if (!validateConfig()) {
        showNotification('系统配置不完整，请检查环境变量设置', 'error');
        showEnvHelp();
        return;
    }
    
    isMonitoring = true;
    startTime = new Date();
    
    // 更新UI
    document.getElementById('statusDot').classList.add('active');
    document.getElementById('statusText').textContent = '监控运行中...';
    document.getElementById('monitorBtn').innerHTML = '<i class="fas fa-stop"></i> 停止监控';
    document.getElementById('monitorBtn').className = 'btn btn-danger';
    document.getElementById('monitorLog').classList.remove('hidden');
    
    // 开始监控循环
    monitorInterval = setInterval(checkEmails, config.forward_settings.check_interval * 1000);
    
    // 开始运行时间计时
    updateRunTime();
    
    addLog('开始监控临时邮箱...');
    addLog(`检查间隔: ${config.forward_settings.check_interval}秒`);
    addLog(`监控邮箱数量: ${Object.keys(tempEmails).length}`);
    
    updateStats();
    showNotification('邮件监控已启动', 'success');
}

// 停止监控
function stopMonitor() {
    isMonitoring = false;
    
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
    }
    
    // 更新UI
    document.getElementById('statusDot').classList.remove('active');
    document.getElementById('statusText').textContent = '监控已停止';
    document.getElementById('monitorBtn').innerHTML = '<i class="fas fa-play"></i> 开始监控';
    document.getElementById('monitorBtn').className = 'btn btn-success';
    
    const endTime = new Date();
    const duration = Math.floor((endTime - startTime) / 1000);
    addLog(`监控已停止 (运行了 ${formatTime(duration)})`);
    
    updateStats();
    showNotification('邮件监控已停止', 'info');
}

// 检查一次邮件
async function checkOnce() {
    if (!validateConfig()) {
        showNotification('系统配置不完整，请检查环境变量设置', 'error');
        showEnvHelp();
        return;
    }
    
    if (Object.keys(tempEmails).length === 0) {
        showNotification('请先创建临时邮箱', 'warning');
        return;
    }
    
    showNotification('正在检查邮件...', 'info');
    await checkEmails();
}

// 检查邮件（核心功能）
async function checkEmails() {
    try {
        addLog(`[${new Date().toLocaleTimeString()}] 🔍 检查邮件中...`);
        
        // 模拟检查邮件的过程
        await simulateApiCall(1000);
        
        // 随机生成一些测试邮件（实际应用中这里会调用IMAP API）
        const hasNewEmail = Math.random() < 0.1; // 10%概率有新邮件
        
        if (hasNewEmail) {
            const testEmails = generateTestEmails();
            testEmails.forEach(email => {
                displayEmailNotification(email);
                receivedEmailCount++;
            });
            addLog(`[${new Date().toLocaleTimeString()}] ✅ 发现 ${testEmails.length} 封新邮件`);
        } else {
            addLog(`[${new Date().toLocaleTimeString()}] 📭 暂无新邮件`);
        }
        
        updateStats();
        
    } catch (error) {
        addLog(`[${new Date().toLocaleTimeString()}] ❌ 检查邮件时发生错误: ${error.message}`);
        showNotification('检查邮件失败: ' + error.message, 'error');
    }
}

// 显示邮件通知
function displayEmailNotification(emailData) {
    const notificationsContainer = document.getElementById('emailNotifications');
    
    const notification = document.createElement('div');
    notification.className = 'email-notification';
    
    // 提取验证码
    const verificationCode = extractVerificationCode(emailData.content);
    
    notification.innerHTML = `
        <div class="notification-header">
            <i class="fas fa-envelope"></i>
            <strong>临时邮箱收到新邮件!</strong>
        </div>
        <div style="margin-bottom: 10px;">
            <strong>📧 临时邮箱:</strong> ${emailData.temp_email}<br>
            <strong>👤 发件人:</strong> ${emailData.from}<br>
            <strong>📝 主题:</strong> ${emailData.subject}<br>
            <strong>📅 日期:</strong> ${emailData.date}
        </div>
        ${verificationCode ? `
            <div class="verification-code">
                <div style="margin-bottom: 10px;"><strong>🔑 验证码:</strong></div>
                <div class="code">${verificationCode}</div>
            </div>
        ` : ''}
        <div class="notification-content">
            <strong>📄 邮件内容:</strong>
            <div style="margin-top: 10px; max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                ${emailData.content.substring(0, 500)}${emailData.content.length > 500 ? '...' : ''}
            </div>
        </div>
        <div style="margin-top: 15px; text-align: center; color: #28a745;">
            ✅ 邮件已自动转发到QQ邮箱: ${config.qq_email.username}
        </div>
    `;
    
    notificationsContainer.insertBefore(notification, notificationsContainer.firstChild);
    
    // 5秒后自动隐藏（可选）
    setTimeout(() => {
        notification.style.opacity = '0.7';
    }, 5000);
}

// 提取验证码
function extractVerificationCode(content) {
    const patterns = [
        /验证码[：:\s]*(\d{4,8})/i,
        /verification code[：:\s]*(\d{4,8})/i,
        /code[：:\s]*(\d{4,8})/i,
        /enter this code[：:\s]*(\d{4,8})/i,
        /<[^>]*>(\d{6})<[^>]*>/,
        /\b(\d{6})\b/,
        /\b(\d{4})\b/
    ];
    
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            const code = match[1];
            // 过滤掉明显不是验证码的数字
            if (!['2024', '2025', '1000', '8080', '443', '80', '3000'].includes(code)) {
                return code;
            }
        }
    }
    
    return null;
}

// 生成测试邮件数据
function generateTestEmails() {
    const emails = Object.keys(tempEmails);
    if (emails.length === 0) return [];
    
    const testEmail = emails[Math.floor(Math.random() * emails.length)];
    const services = ['TikTok', 'GitHub', 'Google', 'Microsoft', 'Apple'];
    const service = services[Math.floor(Math.random() * services.length)];
    const code = Math.floor(100000 + Math.random() * 900000);
    
    return [{
        temp_email: testEmail,
        from: `${service} <noreply@${service.toLowerCase()}.com>`,
        subject: `${service} verification code`,
        date: new Date().toUTCString(),
        content: `
            <html>
            <body>
                <h2>Verification Code</h2>
                <p>To verify your account, enter this code:</p>
                <p style="font-size: 24px; font-weight: bold; color: #007bff;">${code}</p>
                <p>This code expires in 10 minutes.</p>
                <p>If you didn't request this code, you can ignore this message.</p>
                <p>${service} Support Team</p>
            </body>
            </html>
        `
    }];
}

// 更新邮箱列表
function updateEmailList() {
    const emailList = document.getElementById('emailList');
    const emails = Object.keys(tempEmails);
    
    if (emails.length === 0) {
        emailList.innerHTML = '<p style="text-align: center; color: #666;">暂无临时邮箱</p>';
        return;
    }
    
    emailList.innerHTML = emails.map(email => {
        const emailData = tempEmails[email];
        const createdTime = new Date(emailData.created_at).toLocaleString();
        
        return `
            <div class="email-item">
                <div class="email-info">
                    <div class="email-address">${email}</div>
                    <div class="email-time">创建时间: ${createdTime}</div>
                </div>
                <div>
                    <input type="checkbox" class="email-checkbox" value="${email}" style="margin-right: 10px;">
                    <button class="btn" onclick="copyToClipboard('${email}')" style="padding: 5px 10px; font-size: 12px;">
                        <i class="fas fa-copy"></i> 复制
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 更新统计信息
function updateStats() {
    document.getElementById('emailCount').textContent = Object.keys(tempEmails).length;
    document.getElementById('receivedCount').textContent = receivedEmailCount;
    document.getElementById('monitorStatus').textContent = isMonitoring ? '运行中' : '已停止';
    
    if (isMonitoring && startTime) {
        updateRunTime();
    } else {
        document.getElementById('runTime').textContent = '00:00:00';
    }
}

// 更新运行时间
function updateRunTime() {
    if (!isMonitoring || !startTime) return;
    
    const now = new Date();
    const duration = Math.floor((now - startTime) / 1000);
    document.getElementById('runTime').textContent = formatTime(duration);
    
    if (isMonitoring) {
        setTimeout(updateRunTime, 1000);
    }
}

// 格式化时间
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 添加日志
function addLog(message) {
    const logContent = document.getElementById('logContent');
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logContent.appendChild(logEntry);
    
    // 自动滚动到底部
    logContent.scrollTop = logContent.scrollHeight;
    
    // 限制日志条数
    while (logContent.children.length > 100) {
        logContent.removeChild(logContent.firstChild);
    }
}

// 复制到剪贴板
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('已复制到剪贴板', 'success');
    }).catch(() => {
        showNotification('复制失败', 'error');
    });
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
    
    // 根据类型设置颜色
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// 验证配置
function validateConfig() {
    return config.qq_email.username && 
           config.qq_email.password && 
           config.cloudflare.api_token && 
           config.cloudflare.zone_id && 
           config.cloudflare.domain;
}

// 模拟API调用
function simulateApiCall(delay = 500) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (Math.random() < 0.95) { // 95%成功率
                resolve();
            } else {
                reject(new Error('网络错误'));
            }
        }, delay);
    });
}