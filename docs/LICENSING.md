# 许可说明与知识产权声明 · Licensing & Attribution

> **官方出品**：**SUVA · 苏哇科技 (SUVA Tech)**  
> **上游维护**：SUVA Imaging Laboratory（光影实验室知识库与数字知产中心）  
> **许可证类型**：`PixelCrystal Source-Available Personal Non-Commercial License 1.0`（源码可见 · 限浏览与个人非商业体验 · 禁止二次分发与商用）

---

## 1. 授权速览（您可以做什么 / 不可以做什么）

| 行为类别 | 是否允许 | 说明 |
| :--- | :---: | :--- |
| **在线浏览源码与游玩官方网页** | **允许** | 欢迎访问官方 GitHub 仓库与官方 GitHub Pages 在线体验 |
| **个人电脑本地运行与科普自学** | **允许** | 限个人非商业娱乐、晶体光学自学与课堂个人演示（非收费） |
| **分享游戏内生成的像素纪念集章卡** | **允许** | 保留卡片上的 `SUVA · 苏哇科技` 像素铭牌，欢迎附官方链接分享 |
| **二次分发源码 / 安装包 / 离线 HTML** | **严禁** | 禁止打包网盘、转载代码仓、建立第三方公开镜像网站或小程序 |
| **任何商业应用与变现场景** | **严禁** | 禁止用于付费课程、商业培训、门店展示、广告站点、SaaS 或商业衍生品 |
| **抹除或篡改 SUVA · 苏哇科技 署名** | **严禁** | 所有私人副本均须完整保留 `LICENSE` 与官方来源标识 |

正式法律文本以仓库根目录 [`LICENSE`](../LICENSE) 英文条款为准。

---

## 2. 第三方科学数据与开放许可说明

本项目代码、像素光栅化渲染器、交互式关卡与像素美术均由 **SUVA · 苏哇科技** 独立编写与设计，零外部运行时 npm 依赖。其中引用的公开科学常数与标准色度数据保留各自原有属性：

1. **CIE 1931 2° 标准色匹配函数（5 nm 子集，380–780 nm）**
   - 来源：International Commission on Illumination (CIE), `DOI: 10.25039/CIE.DS.xvudnb9b`
   - 许可：**CC BY-SA 4.0**（<https://creativecommons.org/licenses/by-sa/4.0/>）
   - 变更说明：从官方 1 nm 表按 5 nm 步长抽取可见光教学子集，用于计算正交偏光米歇尔-莱维干涉色谱与锥光白光积分；该数值数组本身继续遵循 CC BY-SA 4.0。
2. **矿物学与晶体光学公开文献常数**
   - 矿物主折射率、晶系、比重代表值参考 *Handbook of Mineralogy*（Mineralogical Society of America）。
   - 石英与方解石室温色散方程参考 Ghosh (1999), *Optics Communications* `163`, 95–102。
   - 合成刚玉室温 Sellmeier 色散系数参考 Malitson & Dodge (1972), *JOSA* `62`(11), 1405。
   - 石英旋光张量参考 Arteaga, Canillas & Jellison (2009), *Applied Optics* `48`(29), 5500。
   - 纯水密度温度公式参考 Tanaka et al. (2001), *Metrologia* `38`(4), 301。

---

## 3. 商标与品牌声明

`SUVA`、`苏哇科技`、`SUVA Tech`、`像素晶体`、`PixelCrystal` 为权利人持有的品牌及项目标识。本仓库公开源码仅供透明度审阅与个人学习体验，不构成任何商标授权或许可背书。如需商业合作、教学机构正式授权或展览定制，请通过 SUVA 官方渠道联系取得书面授权。
