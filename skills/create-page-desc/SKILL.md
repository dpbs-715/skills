---
name: create-page-desc
description: Trigger when the user enters /createDesc or asks to turn a prototype, screenshot, frontend code, or written requirements into a concise Markdown description for recreating a static page.
---

# Create Page Description

Extract the visible page structure from the supplied source and produce a concise Markdown description that another agent or developer can use to recreate the page as a static interface.

## Inputs

Accept one or more of these sources:

- prototypes or design links
- screenshots or other page images
- existing frontend code
- written page requirements

Inspect the supplied source directly when it is accessible. When reading code, describe only structure and behavior that affect the rendered page; omit implementation details such as state-management internals, request wrappers, and utility functions.

## Output Rules

- Follow the user's language.
- State only what the source supports. Do not invent fields, business rules, validation, visual specifications, or interactions.
- Preserve visible names, hierarchy, component types, field order, button order, and row actions.
- Keep descriptions compact. Prefer inline field and action lists over tables.
- Omit any section that does not apply.
- If a small ambiguity does not prevent a useful description, mark it briefly as `待确认` instead of expanding the document.
- Return Markdown in the response unless the user requests a file or provides an output path.
- Do not modify the source page or its code.

## Markdown Shape

Use the smallest useful subset of this structure:

```markdown
# 页面名称

页面整体布局和主要区域说明。

## 模块名称 / Tab 名称

### 查询条件

字段名称（组件类型） 字段名称（组件类型）

### 操作栏

按钮名称 按钮名称

### 列表字段

字段名称 字段名称 操作列（详情 编辑 删除）

### 表单 / 弹窗 / 抽屉

字段名称（组件类型） 字段名称（组件类型）

### 交互说明

必要的切换、展开、弹窗、抽屉或按钮交互。
```

Use the actual module name for headings. When a page has multiple tabs with the same structure, describe the known content of each tab; do not replace missing details with speculative fields.
