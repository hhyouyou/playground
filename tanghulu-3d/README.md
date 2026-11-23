# 糖露 TANGLU — 奶皮子糖葫芦

根据提供的新参考图制作的 Three.js 简单版三维模型：竖直竹签、三颗尖端朝上的草莓、前方开口的奶皮子薄片，以及独立透明糖衣。

## 运行

### Vite（推荐）

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

打开终端输出的本地地址。

### 普通静态服务器

依赖已安装时，也可以在项目目录直接运行：

```bash
python -m http.server 4173 --bind 127.0.0.1
```

访问 `http://127.0.0.1:4173/`。`index.html` 中的 import map 会从本地 `node_modules` 加载 Three.js。

### 生产构建

```bash
npm run build
npm run preview
```

构建产物位于 `dist/`。

## 交互

- 拖动旋转、滚轮或双指缩放
- 食材列表与三维标注：聚焦对应细节
- 「旋转」：开关自动旋转
- 「拆解」：分离糖衣、草莓和奶皮子
- 「标注」：显示或隐藏标签
- 「留影」：导出当前视角 PNG
- 快捷键：`R` 重置、`E` 拆解、`H` 标注、空格旋转

## 模型细节

- 草莓直接按宽头朝下、尖端朝上建模，并非将旧模型倒置
- 64 段旋转曲面、每颗 71 颗独立实例化果籽及对应凹槽
- 奶皮子带前方开口、波浪边缘与两道细卷边
- 糖衣使用物理透射、折射率与独立厚度
- 竹签纵向木纹、陶瓷底座与实时阴影

## 文件

- `index.html`：展示页面与参考图弹窗
- `src/model.js`：模型、材质与程序化贴图
- `src/main.js`：场景、相机和交互
- `src/style.css`：响应式界面
- `preview.png`：默认视角实际浏览器截图
- `preview-exploded.png`：分层视角实际浏览器截图
- `browser-verification.json`：浏览器自动检查结果
- `scripts/verify-browser.mjs`：基于 Chrome DevTools Protocol 的交互检查脚本

## 已验证

- Vite 生产构建成功
- Chrome / WebGL 实际渲染成功
- 草莓方向、旋转、拆解、食材聚焦、标注、弹窗和重置全部通过
- 运行时异常：0
- 浏览器控制台错误：0
