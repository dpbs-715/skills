---
name: create-page-desc
description: Trigger when the user enters /createDesc or asks to turn a prototype, screenshot, frontend code, or written requirements into a structured Markdown specification of a static page's hierarchy, regions, fields, interactions, states, and suggested code organization.
---

# Create Page Description

Extract the visible page hierarchy, content, and behavior from the supplied source. Produce a structured Markdown specification that makes the page relationships and implementation boundaries clear enough to recreate the static interface.

## Inputs

Accept one or more of these sources:

- prototypes or design links
- screenshots or other page images
- existing frontend code
- written page requirements

Inspect the supplied source directly when it is accessible. When reading project code, describe only structure and behavior that affect the rendered page, and inspect nearby project structure only as needed to make the code-organization suggestion consistent with the existing conventions. Treat prototypes, design links, screenshots, and written requirements as implementation-agnostic design sources.

## Output Rules

- Follow the user's language.
- Clearly separate observed page facts from implementation suggestions.
- State only what the source supports for fields, business rules, validation, and interactions. Mark small unresolved items as `待确认`.
- Describe the page relationship before listing fields: parent page, primary tabs or modules, regions within each module, actions that open another interface, and nested tabs or field groups inside that interface.
- Make parent-child relationships explicit in prose and heading levels. Do not present sibling tabs as unrelated pages.
- Preserve visible names, hierarchy, default selection, component types, field order, button order, and row actions.
- Distinguish selector behavior when the source exposes it. Use precise component names such as `单选选择器`, `多选选择器`, `单选级联选择器`, and `多选级联选择器` instead of the generic `选择器`.
- Inspect both query fields and form fields for selection mode. Do not infer multi-select behavior from the field name alone; when the mode cannot be verified, write `选择器（单/多选待确认）`.
- Use compact tables when fields need exact component, display, or behavior mappings. Use prose for hierarchy and relationships.
- Omit any section that does not apply.
- Describe structural layout and region order, but omit decorative styling details such as colors, shadows, borders, corner radii, spacing values, font families, and font sizes unless the user explicitly asks for them.
- Include only meaningful interactions needed to understand the static page: tab switching, search/reset, row actions, dialogs, drawers, expansion, pagination, and visible field linkage.
- Include loading, empty, disabled, and error states only when the source shows them or they are necessary to reproduce an explicitly requested static demonstration.
- Do not report or infer a target technology stack from the implementation of a prototype or design-preview site. Omit its framework, component library, build tool, source filenames, and other implementation metadata.
- End with a suggested code structure. When the input is existing project code, prefer that project's feature ownership, framework, naming, and file layout. When the user explicitly supplies a target technology stack, adapt the suggestion to it.
- For prototypes, screenshots, design links, and written requirements without a user-specified target stack, provide a framework-neutral feature-local tree with placeholder extensions such as `<ext>`.
- Do not create speculative shared abstractions or split every small region into its own file.
- Return Markdown in the response unless the user requests a file or provides an output path.
- Do not modify the source page or its code.

## Required Output Structure

Adapt this structure to the source and omit sections with no supporting content:

````markdown
# 页面名称

## 1. 页面概述

- 页面类型：列表页 / 表单页 / 详情页 / 工作台
- 页面内容：一句话说明页面包含的核心内容

## 2. 页面结构与关系

页面下包含若干个并列的一级 Tab：Tab A、Tab B，默认显示 Tab A。
每个 Tab 内按顺序包含查询区、操作栏、列表区和分页。点击新增或编辑后，打开当前 Tab 对应的表单弹窗。

## 3. Tab A

### 3.1 查询条件

| 字段 | 组件类型 | 默认值/占位提示 | 可选项或格式 |
|---|---|---|---|
| 字段名称 | 多选选择器 | 请选择 | 可选择多个选项 |

查询操作：搜索、重置。

### 3.2 操作栏

| 操作 | 展现形式 | 打开的界面或可见结果 |
|---|---|---|
| 新增 | 按钮 | 打开新增弹窗 |

### 3.3 列表字段

| 字段 | 展示形式 | 备注 |
|---|---|---|
| 字段名称 | 文本 / 标签 / 日期 | 必要的展示说明 |
| 操作 | 文字按钮 | 详情、编辑、删除 |

### 3.4 新增/编辑弹窗

该弹窗由当前 Tab 的新增或编辑操作打开，内部包含两个二级 Tab：基本信息、其他信息。

#### 基本信息

| 字段 | 组件类型 | 必填/只读 | 默认值或格式 |
|---|---|---|---|
| 字段名称 | 单选选择器 | 必填 | 请选择一个选项 |

#### 其他信息

字段表同上。

## 4. 关键交互

- 一级 Tab 的切换关系
- 查询、重置和分页
- 新增、详情、编辑、删除打开的界面
- 弹窗内二级 Tab 或字段联动

## 5. 页面状态

- 加载状态：仅在来源中可见或明确要求时描述
- 空数据状态：仅在来源中可见或明确要求时描述
- 禁用/错误状态：仅在来源中可见或明确要求时描述

## 6. 待确认项

- 仅记录影响页面还原但来源未明确的内容

## 7. 建议代码结构

```text
<feature>/
├── index.<ext>                 # 页面入口与模块组合
├── components/
│   ├── <PrimaryTab>.<ext>      # 拥有独立字段和交互的一级 Tab
│   └── <Entity>Form.<ext>      # 新增/编辑表单
├── config/
│   ├── searchFields.<ext>      # 稳定的查询字段配置
│   └── tableColumns.<ext>      # 稳定的列表字段配置
├── types.<ext>                 # 页面使用的数据结构
└── mockData.<ext>              # 仅静态演示需要时添加
```

- 说明页面入口、Tab、表单和字段配置之间的职责关系。
- 简单页面可以合并文件；只有拥有独立职责或稳定配置时才拆分。
````

Use actual page, tab, module, region, entity, and interface names instead of template placeholders. Repeat the module section for each primary tab or sibling module. Include only hierarchy levels that exist. Do not replace missing details with speculative fields.
