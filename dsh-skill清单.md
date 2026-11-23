# DSH 可见 Skill 清单（整理版）

> 采样：2026-11-22 · 初次采样 38 个，当日收起 27 个飞书 skill 后当前 **11** 个 · profile = `desktop` · 工作区 `playgrand`
> 另有 2 个 MCP 服务器（`train12306`、`weather`），它们提供的是"工具"而不是 skill，不计入本清单。

## 1. 来源总览

| 来源 | 数量 | 落盘位置 | 维护方式 |
|---|---|---|---|
| 飞书官方 `larksuite/cli` | 27 | `~/.agents/skills/lark-*` | 整体安装/更新（最近一次 2026-07-21） |
| 自装图像工具包 | 2 | `~/.agents/skills/gpt-image*` | 手动拷贝（2026-10-31） |
| DSH Office 套件 | 4 | 应用内 `@deepseek-ai/dsh-skill-office` | 随应用升级 |
| DSH 其他内置 | 5 | 应用内各包（preset / skill-badge / sandbox-windows-acl / *-recommendations） | 随应用升级 |

合计 27 + 2 + 4 + 5 = 38。

## 2. 分类清单

> 2.1–2.5 的飞书 27 个已于 2026-11-22 全部下线，保留在此作为能力索引；需要用时按第 5 节恢复。

### 2.1 飞书 · 沟通协作（9）

| Skill | 能做什么 | 什么时候会触发 |
|---|---|---|
| `lark-im` | 收发消息、群聊管理、上传下载、表情回复、加急、交互卡片 | 发消息 / 看聊天记录 / 下载聊天文件 |
| `lark-mail` | 起草、发送、回复、搜索邮件，标签、文件夹、收信规则、监听新邮件 | 提到"邮件" |
| `lark-contact` | 姓名/邮箱 ↔ open_id，查部门、联系方式、个人状态 | 需要给人发消息、排日程前解析人名 |
| `lark-calendar` | 日程增删改查、参会人、忙闲、推荐时段、订会议室 | 排会 / 看安排 |
| `lark-task` | 待办、清单、子任务、协作成员、任务智能体 | 建待办 / 跟任务进度 |
| `lark-approval` | 审批待办/已办、查审批定义并发起实例 | 处理审批（注意：审批待办 ≠ 飞书任务） |
| `lark-attendance` | 查自己的考勤打卡记录 | 只看本人打卡 |
| `lark-okr` | OKR 周期、目标、KR、对齐关系、进展记录 | 写/看 OKR |
| `lark-event` | 以 NDJSON 流订阅 IM、审批、任务、VC、妙记等实时事件 | 开发常驻机器人/订阅器 |

### 2.2 飞书 · 会议与纪要（4）

| Skill | 能做什么 | 什么时候会触发 |
|---|---|---|
| `lark-vc` | 搜索已结束会议、查纪要/妙记/参会人快照 | 回顾历史会议 |
| `lark-vc-agent` | 机器人真实入会/离会、读会中事件、发会中消息 | 问"正在开的会" |
| `lark-note` | 已知 `note_id` 时查纪要详情、关联文档、逐字记录 | 手里已有 note_id |
| `lark-minutes` | 妙记搜索、音视频上传下载、改标题、换说话人、申请权限 | 本地音视频转纪要 |

### 2.3 飞书 · 文档与内容（9）

| Skill | 能做什么 | 什么时候会触发 |
|---|---|---|
| `lark-doc` | 读写 docx / wiki 文档内容、插图、下载附件 | 给了文档 URL/token |
| `lark-wiki` | 知识空间、成员、节点层级、快捷方式 | 在知识库里找/建文档 |
| `lark-drive` | 云空间文件/文件夹增删改查、权限、版本、导入 | 整理云盘、判断链接类型 |
| `lark-markdown` | 本地 Markdown 读写、局部 patch、diff | 编辑本地 .md |
| `lark-sheets` | 表格结构、单元格/公式/样式/图片、图表、透视表、条件格式 | 建表、批量读写、建模 |
| `lark-base` | 多维表格建表、字段、记录、视图、表单、仪表盘、workflow | 遇到 Base / bitable 链接 |
| `lark-slides` | 幻灯片创建、页面读取与局部替换 | 做 deck |
| `lark-whiteboard` | 画板导出预览图、导出原始结构、更新内容 | 看/改画板 |
| `lark-apps` | 妙搭应用：本地全栈开发、云端迭代、部署、日志、环境变量、自动化触发 | 要做一个应用/网站/原型 |

### 2.4 飞书 · 平台与开发（3）

| Skill | 能做什么 | 什么时候会触发 |
|---|---|---|
| `lark-shared` | lark-cli 登录/状态/身份/权限域（`--domain`）、缺失 scope | 鉴权、授权类问题 |
| `lark-openapi-explorer` | 从官方文档挖未封装的原生 OpenAPI 并调用 | 现有 lark-* 覆盖不到 |
| `lark-skill-maker` | 把飞书 API 封装成可复用 skill | 要造 lark 自定义 skill |

### 2.5 工作流编排（2）

| Skill | 能做什么 |
|---|---|
| `lark-workflow-meeting-summary` | 汇总某时间范围的会议纪要 → 结构化报告（周报） |
| `lark-workflow-standup-report` | `calendar +agenda` + `task +get-my-tasks` → 当日日程+未完成事项摘要 |

### 2.6 图像生成（2）

| Skill | 能做什么 |
|---|---|
| `gpt-image` | 生图工具手册：`gpt-image_gen` / `gpt-image_edits`，4 个模型与工作流 |
| `gpt-image-2-style-library` | 2 MB 风格库：分类、风格/场景标签、工业级提示词模板、坑位 |

### 2.7 Office 文件（4）

| Skill | 能做什么 |
|---|---|
| `office` | 总入口：启用 `office_render` / `office_convert` / `office_recalculate` |
| `office-docx` | Word 创建、读取、编辑、校验 |
| `office-pptx` | PowerPoint 创建、读取、编辑、校验 |
| `office-xlsx` | Excel 读取、创建、编辑、公式校验 |

### 2.8 DSH 自身（5）

| Skill | 能做什么 |
|---|---|
| `dsh-doc` | DSH 自身的事实来源：功能、插件、预设、Cordis API、版本升级 |
| `official-plugins` | 查 DSH 官方可选插件（"这个功能能不能做/怎么做"） |
| `personalized-pages` | 提议在本 App 里做一个页面/面板/小工具 |
| `dsh-badge` | 给文档/PR 加 "powered by dsh" 徽章 |
| `diagnose-windows-sandbox-acl` | Windows 沙箱 ACL 诊断与修复（仅异常拒绝时） |

## 3. 重叠关系：看着像重复，其实各管一段

| 组合 | 关系 | 结论 |
|---|---|---|
| `office` + `office-docx/pptx/xlsx` | 1 个入口 + 3 个格式实现，互为前置 | **全留**，拆开会缺渲染/校验能力 |
| `lark-vc` / `lark-vc-agent` / `lark-note` / `lark-minutes` | 按输入分家：历史会议 / 会中 / note_id / 音视频+妙记 | 做哪段留哪段 |
| `lark-markdown` vs `lark-doc` | 本地 .md 文件 vs 飞书在线文档 | 不冲突，只写本地可停 |
| `lark-workflow-*` | 是 `calendar`+`task`、`vc`+`minutes` 的组合封装 | 留省事，停也能手动拼 |
| `lark-apps` vs `office` | 妙搭做应用 vs 本地产 Office 文件 | 场景不同 |
| `lark-shared` | 鉴权前置，其它 lark-\* 报授权错时会用到 | 建议留 |

## 4. 怎么整理（三种力度）

Skill 的发现规则（`@deepseek-ai/dsh-skill-filesystem`）：每个根目录**只扫一层**，认 `<root>/<name>/SKILL.md` 或 `<root>/<name>.md`，并监听目录，**改完下个模型步骤就生效，不用重启**。

扫描根与优先级（rank 越小越优先）：

| rank | 来源 | 路径 |
|---|---|---|
| 100 | project-dsh | `<项目根>/.dsh/skills` |
| 200 | project-agents | `<项目根>/.agents/skills` |
| 300 | custom | `customSkillDirs` 配置 |
| 400 | user-dsh | `~/.dsh/skills` |
| 500 | user-agents | `~/.agents/skills`（当前 29 个都在这里） |
| 600 | bundled | `$DSH_BUNDLED_SKILL_DIR` |

**A. 只想让它别出现在目录里（最轻，可逆）**
在对应 `SKILL.md` 的 frontmatter 加一行：

```yaml
disable-model-invocation: true
```

文件保留，模型目录里不再出现；想恢复就删掉这行。

**B. 暂时收起**
把 `~/.agents/skills/<name>` 整个目录移到 `~/.agents/skills-off/`。注意只扫一层——**塞进任何子目录就等于下线**，不要再往 `~/.agents/skills/` 下建分类文件夹。

**C. 彻底删除**
删目录后，同步从 `~/.agents/.skill-lock.json` 删掉同名条目，否则更新工具仍认为它装着。

**D. 内置的 9 个**
随应用/bundle 提供，不能单独删；要去掉只能在 profile 的 `cordis.patch.yml` 里停用对应 bundle（`dsh-skill-office`、`dsh-skill-badge` 等）——不建议为省几条描述去动它。

**E. 分层建议**
- 项目专用 skill → `<项目>/.dsh/skills`
- 个人常用 → `~/.dsh/skills`
- 跨工具共享（飞书/图像这类也从 Claude/Trae 读的）→ `~/.agents/skills` 保持不变

## 5. 已执行：38 → 11（2026-11-22）

> 状态：飞书 27 个全部下线（分两批），会话目录 38 → 11。
> 每个下线的 skill 只在 frontmatter 加了一行 `disable-model-invocation: true`，其余字节未动（已逐文件往返校验）；原件备份为同目录 `SKILL.md.bak`。

| 保留（11） | 理由 |
|---|---|
| `gpt-image` `gpt-image-2-style-library` | 视觉设计 Agent 的核心（2） |
| `office` `office-docx` `office-pptx` `office-xlsx` | 出 docx/pptx/xlsx 的刚需（4） |
| `dsh-doc` | 问 DSH 自身时的事实来源（1） |
| `dsh-badge` `diagnose-windows-sandbox-acl` `personalized-pages` `official-plugins` | 内置，无法单独下线，只能停 bundle（4） |

**已下线：飞书 27 个（两批，2026-11-22）**

| 批次 · 分组 | Skill |
|---|---|
| 第一批 · 个人事务 | `lark-attendance` `lark-okr` |
| 第一批 · 内容创作 | `lark-apps` `lark-whiteboard` `lark-slides` |
| 第一批 · 会议纵深 | `lark-vc-agent` `lark-note` `lark-minutes` `lark-workflow-meeting-summary` |
| 第一批 · 开发飞书 | `lark-event` `lark-skill-maker` `lark-openapi-explorer` |
| 第一批 · 按需 | `lark-mail` `lark-approval` `lark-contact` `lark-markdown` `lark-workflow-standup-report` |
| 第二批 · 主力（整体没用过） | `lark-im` `lark-calendar` `lark-task` `lark-doc` `lark-sheets` `lark-drive` `lark-base` `lark-wiki` `lark-vc` `lark-shared` |

**恢复单个**：`Copy-Item ~/.agents/skills/<name>/SKILL.md.bak ~/.agents/skills/<name>/SKILL.md -Force`，或直接删掉 `disable-model-invocation` 那一行。

**批量恢复**：

```powershell
Get-ChildItem ~/.agents/skills -Directory | ForEach-Object {
  $bak = Join-Path $_.FullName 'SKILL.md.bak'
  if (Test-Path $bak) { Copy-Item $bak (Join-Path $_.FullName 'SKILL.md') -Force }
}
```

改完下个模型步骤即刷新，不用重启。注意：以后若重新 `skills add larksuite/cli` 更新，27 个会被整体装回并覆盖 frontmatter，需要重做上面的标记。

## 6. 备注

- 清单里的描述每轮都会进模型上下文。当前 11 条（原来 38 条），已按"飞书整体不用"收缩；以后启用飞书再按第 5 节恢复，不必一次全开。
- 版本/时间：飞书套件 `installedAt` 2026-06-21、`updatedAt` 2026-07-21；图像套件目录时间 2026-10-31。
