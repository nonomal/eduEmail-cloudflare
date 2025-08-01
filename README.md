# 先打个广告
我的另一个项目*AI公众号自动发文助手：https://github.com/wojiadexiaoming-copy/AIWeChatauto.git
# 临时邮箱转发系统 - 前端界面

这是基于Cloudflare Email Routing的临时邮箱转发系统前端界面，使用纯HTML、CSS和JavaScript构建。

## 🌟 核心特性

### 📧 临时邮箱管理
- **基于Cloudflare域名**：利用你自己的域名创建临时邮箱（如：temp_abc123@yourdomain.com）
- **自动转发规则**：通过Cloudflare Email Routing自动转发到你的QQ邮箱
- **批量管理**：支持创建多个临时邮箱，统一管理和删除
- **一键复制**：临时邮箱地址自动复制到剪贴板

### 🔄 智能邮件监控
- **实时监控**：持续监控转发到QQ邮箱的邮件
- **验证码提取**：自动识别并高亮显示各种验证码
- **时间过滤**：只处理临时邮箱创建后收到的新邮件
- **状态显示**：实时显示监控状态和统计信息

### 🎨 现代化界面
- **响应式设计**：完美支持桌面和移动设备
- **环境变量配置**：自动从环境变量加载配置，无需手动输入
- **动画通知**：邮件到达时的流畅动画效果
- **广告位预留**：侧边栏预留商业化广告空间

## 🏗️ 工作原理

```
1. 用户访问网站 → 2. 创建临时邮箱 → 3. Cloudflare创建转发规则
                                    ↓
6. 前端显示通知 ← 5. 系统监控QQ邮箱 ← 4. 邮件自动转发到QQ邮箱
```

### 详细流程：
1. **域名配置**：使用你在Cloudflare托管的域名
2. **临时邮箱创建**：系统生成格式为 `temp_随机字符@你的域名.com` 的邮箱地址
3. **转发规则**：通过Cloudflare API自动创建邮件转发规则
4. **邮件接收**：任何发送到临时邮箱的邮件都会自动转发到你的QQ邮箱
5. **实时监控**：系统监控QQ邮箱，检测转发过来的邮件
6. **智能通知**：在网页上实时显示新邮件，并自动提取验证码

## 📁 文件结构

```
frontend/
├── index.html          # 主页面
├── styles.css          # 样式文件
├── script.js           # JavaScript逻辑
├── package.json        # 项目配置
└── README.md          # 说明文档
```

## 🚀 使用方法

### 1. 直接打开
```bash
# 用浏览器直接打开
open index.html
```

### 2. 本地服务器
```bash
# 使用Python
python -m http.server 8000

# 使用Node.js
npx serve .

# 然后访问 http://localhost:8000
```

### 3. 与后端集成
```bash
# 从项目根目录启动服务器
cd ..
node server.js

# 访问 http://localhost:3000
```

## 🔧 环境变量配置

### 配置来源
前端会自动尝试从以下来源加载配置：

1. **服务器API** (`/api/env`) - 推荐方式
2. **本地存储** (localStorage) - 浏览器缓存
3. **process.env** (Node.js环境) - 开发环境

### 必需的环境变量

#### Cloudflare配置
- `TEMP_EMAIL_CF_API_TOKEN` - Cloudflare API令牌（需要Zone:Edit权限）
- `TEMP_EMAIL_CF_ZONE_ID` - 你的域名在Cloudflare的Zone ID
- `TEMP_EMAIL_DOMAIN` - 你的域名（如：example.com）

#### QQ邮箱配置
- `TEMP_EMAIL_QQ_USERNAME` - 你的QQ邮箱地址
- `TEMP_EMAIL_QQ_PASSWORD` - QQ邮箱授权码（不是QQ密码）

#### 可选配置
- `TEMP_EMAIL_CHECK_INTERVAL` - 邮件检查间隔（秒，默认10）

### 配置说明

#### 1. Cloudflare设置
- **域名要求**：必须是在Cloudflare托管的域名
- **邮件路由**：需要在Cloudflare控制台启用Email Routing功能
- **API权限**：API Token需要包含Zone:Edit权限

#### 2. QQ邮箱设置
- **IMAP/SMTP**：需要在QQ邮箱设置中开启IMAP/SMTP服务
- **授权码**：使用QQ邮箱生成的授权码，不是QQ密码
- **安全设置**：建议开启QQ邮箱的安全登录功能

## 🎨 界面设计

### 主要功能区域
- **系统状态**：实时显示Cloudflare和QQ邮箱的配置状态
- **邮箱管理**：创建和管理基于你域名的临时邮箱
- **邮件监控**：实时监控转发邮件，显示详细日志
- **通知系统**：新邮件到达时的动画通知和验证码提取

### 侧边栏商业化
- **广告位1**：300x250尺寸，适合展示广告
- **统计面板**：实时显示邮箱数量、邮件统计、运行状态
- **广告位2**：300x200尺寸，适合推广内容

### 设计亮点
- **渐变背景**：现代化的蓝紫色渐变设计
- **卡片布局**：清晰的功能分区和层次感
- **状态指示**：直观的✅❌⚠️状态图标
- **动画效果**：流畅的交互反馈和通知动画

## 💡 技术特点

### 前端技术
- **纯前端**：无需后端即可运行（演示模式）
- **响应式设计**：自适应各种屏幕尺寸
- **模块化代码**：清晰的代码结构，易于维护
- **动画效果**：流畅的用户交互体验

### Cloudflare集成
- **Email Routing API**：自动创建和管理邮件转发规则
- **域名管理**：基于你的Cloudflare托管域名
- **实时配置**：动态创建和删除临时邮箱
- **安全认证**：使用API Token进行安全访问

### 邮件处理
- **IMAP监控**：实时监控QQ邮箱的新邮件
- **智能过滤**：只处理临时邮箱转发的邮件
- **验证码识别**：支持多种验证码格式的自动提取
- **时间管理**：基于创建时间过滤邮件

## 🔗 API集成

### Cloudflare Email Routing API
前端直接集成Cloudflare API来管理临时邮箱：

```javascript
// 创建邮件转发规则
POST https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/rules

// 删除邮件转发规则  
DELETE https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/rules/{rule_id}

// 查询转发规则列表
GET https://api.cloudflare.com/client/v4/zones/{zone_id}/email/routing/rules
```

### 后端API接口（可选）
如果使用Node.js服务器，支持以下API：

```javascript
// 环境变量API
GET /api/env

// 创建临时邮箱API
POST /api/temp-email

// 检查邮件API
GET /api/check-emails

// 删除邮箱API
DELETE /api/temp-email/:id
```

### 邮件监控
- **QQ邮箱IMAP**：监控转发到QQ邮箱的邮件
- **实时检查**：定期检查新邮件（默认10秒间隔）
- **智能匹配**：识别来自临时邮箱的转发邮件

## 📱 响应式设计

- **桌面端** (>768px)：双栏布局
- **移动端** (≤768px)：单栏布局
- **触摸友好**：适合移动设备操作

## 🚀 部署建议

### 前提条件
1. **Cloudflare账户**：需要有Cloudflare账户并托管域名
2. **域名配置**：域名必须在Cloudflare进行DNS管理
3. **邮件路由**：在Cloudflare控制台启用Email Routing功能
4. **QQ邮箱**：准备一个QQ邮箱用于接收转发邮件

### 静态托管平台
- **GitHub Pages**：免费，适合开源项目
- **Netlify**：自动部署，支持环境变量
- **Vercel**：现代化平台，部署简单
- **阿里云OSS**：国内访问速度快
- **腾讯云COS**：成本低，稳定性好

### 部署配置
1. **环境变量设置**：在托管平台配置环境变量
2. **域名绑定**：绑定自定义域名（可选）
3. **HTTPS启用**：确保使用HTTPS访问
4. **CDN加速**：启用CDN提高访问速度

### 安全建议
- **API Token权限**：只给予必要的Zone:Edit权限
- **环境变量保护**：不要在前端代码中硬编码敏感信息
- **定期更新**：定期更换API Token和邮箱授权码
- **访问控制**：考虑添加访问密码或IP白名单

## 🔧 自定义

### 修改样式
编辑 `styles.css` 文件来自定义界面样式。

### 添加功能
在 `script.js` 中添加新的JavaScript功能。

### 修改布局
编辑 `index.html` 来调整页面布局。

## 📄 许可证

MIT License## 
🌐 Cloudflare Email Routing 详解

### 什么是Cloudflare Email Routing？
Cloudflare Email Routing是一个免费的邮件转发服务，允许你：
- 使用自己的域名接收邮件
- 将邮件转发到任何邮箱地址
- 通过API动态管理转发规则
- 无需自建邮件服务器

### 设置步骤

#### 1. 域名配置
```bash
# 确保域名在Cloudflare托管
# DNS记录会自动配置MX记录
```

#### 2. 启用Email Routing
1. 登录Cloudflare控制台
2. 选择你的域名
3. 进入"邮件" → "邮件路由"
4. 点击"启用邮件路由"
5. 添加目标邮箱地址（你的QQ邮箱）

#### 3. API Token配置
1. 进入"我的个人资料" → "API令牌"
2. 创建自定义令牌
3. 权限设置：
   - Zone:Zone:Read
   - Zone:Zone Settings:Edit
   - Zone:Email Routing Rules:Edit

#### 4. 测试配置
```bash
# 发送测试邮件到 test@yourdomain.com
# 检查是否转发到QQ邮箱
```

### 临时邮箱格式
系统会自动生成以下格式的临时邮箱：
```
temp_a1b2c3d4@yourdomain.com
temp_x9y8z7w6@yourdomain.com
temp_m5n4o3p2@yourdomain.com
```

### 转发规则管理
- **自动创建**：每个临时邮箱对应一个转发规则
- **动态管理**：通过API实时创建和删除规则
- **批量操作**：支持同时管理多个临时邮箱
- **规则清理**：删除临时邮箱时自动清理转发规则

## 🔍 常见问题

### Q: 为什么选择Cloudflare？
A: Cloudflare Email Routing提供：
- ✅ 完全免费的邮件转发服务
- ✅ 强大的API支持动态管理
- ✅ 高可靠性和全球CDN网络
- ✅ 无需自建邮件服务器
- ✅ 支持自定义域名

### Q: 临时邮箱有数量限制吗？
A: Cloudflare Email Routing的限制：
- 免费版：每个域名最多200个转发规则
- 付费版：更高的限制
- 本系统默认限制：10个临时邮箱（可配置）

### Q: 邮件转发有延迟吗？
A: 通常情况下：
- Cloudflare转发延迟：几秒到几十秒
- 系统检测延迟：10秒（可配置）
- 总延迟：通常在1分钟内

### Q: 支持哪些邮件服务商？
A: 目前支持：
- ✅ QQ邮箱（主要支持）
- ✅ 163邮箱（理论支持）
- ✅ Gmail（理论支持）
- ✅ 其他支持IMAP的邮箱

### Q: 如何确保安全性？
A: 安全措施：
- 🔒 API Token权限最小化
- 🔒 环境变量存储敏感信息
- 🔒 HTTPS加密传输
- 🔒 定期更换认证信息
- 🔒 临时邮箱自动过期清理