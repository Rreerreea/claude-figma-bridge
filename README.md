# Claude Figma Bridge

Правки макетов в Figma прямо из Claude Code — через маленький плагин-мост. Claude читает слои, меняет их через Plugin API
и сам проверяет результат по выгрузке PNG. Без Figma MCP и его лимитов, на любом тарифе Figma.

**👉 Пошаговая инструкция для новичков: [ИНСТРУКЦИЯ.md](ИНСТРУКЦИЯ.md)** — как пользоваться, какие задачи давать,
как откатить и что делать, если не работает.

## Установка

**Проще всего:** отправьте Claude Code сообщение

> Установи фигма-мост: https://github.com/Rreerreea/claude-figma-bridge

Или вставьте одну строку в Терминал (macOS, Linux):

```bash
curl -fsSL https://raw.githubusercontent.com/Rreerreea/claude-figma-bridge/main/install.sh | bash
```

После этого остается два шага:

1. В Figma (приложение для компьютера): **Plugins → Development → Import plugin from manifest…** → Документы →
   Claude Bridge → `manifest.json`. Папку установщик откроет сам. Это нужно сделать один раз.
2. Перезапустите Claude Code.

Дальше откройте свой файл, запустите Plugins → Development → **Claude Bridge** и пишите Claude задачу.

> **Для Claude.** Если пользователь просит установить этот репозиторий, выполни в терминале команду `curl … | bash`
> выше (macOS, Linux). На Windows: скачай архив репозитория, скопируй `plugins/figma-bridge/skills/figma-bridge` в
> `~/.claude/skills/figma-bridge`, затем запусти `python3 ~/.claude/skills/figma-bridge/scripts/setup.py start` и
> `… setup.py open`. После установки объясни пользователю шаг с импортом плагина в Figma и попроси перезапустить Claude Code.

Другой способ — как плагин Claude Code (выберите что-то одно, чтобы скилл не стоял дважды):

```
/plugin marketplace add Rreerreea/claude-figma-bridge
/plugin install figma-bridge@claude-figma-bridge
```

Затем скажите Claude «подключи фигма-мост» — он поставит папку с плагином и запустит сервер.

## Что умеет

- Читать структуру фреймов: слои, автолейаут, стили, переменные. Выгружать PNG и смотреть на результат.
- Править: тексты, компоненты и варианты, автолейаут, отступы и скругления через переменные, векторы.
- Собирать рядом с макетом состояния экранов: ввод, ошибка, загрузка, успех, гость или вошел в аккаунт.
- Идти по комментариям заказчика: вы присылаете скрин коммента, Claude объясняет его, делает правку и коротко
  отчитывается.
- Вести файл задач, чтобы следующий чат продолжил с того же места.

Скилл собран из реальной работы над сайтом: компоненты и дизайн-система, страницы, адаптивы, корзина и оформление заказа,
десятки правок по комментариям заказчика. В него упакован порядок работы и все грабли, на которые мы наступили.

## Что нужно

- Figma для компьютера: dev-плагины работают только в приложении, не в браузере.
- [Claude Code](https://claude.com/claude-code), [Node.js](https://nodejs.org/) (LTS) и Python 3.

## Как это устроено

```
Claude Code ──POST /run (токен, имя файла)──▶ сервер на localhost:7787 ◀──GET /next?file=…── плагин в файле Figma
Claude Code ◀──────────── результат ───────── сервер ◀──POST /result──────────────────────── плагин
```

- Папка `Документы/Claude Bridge`: в корне сам плагин (`manifest.json`, `code.js`, `ui.html`), в `server/` — сервер,
  в `out/` — результаты и картинки.
- `scripts/fig.py` — запускает скрипт в файле. Кириллицу переводит в ASCII, картинки сохраняет файлами, отказывается
  работать в чужом файле.
- `scripts/lib.js` — помощники: дерево слоев, PNG, переменные, тексты без потери стиля, варианты компонентов.
- `references/` — порядок работы, грабли, рецепты и пример правил проекта.

## Безопасность

- Сервер слушает только этот компьютер (localhost). При каждом запуске он пишет случайный токен в
  `Документы/Claude Bridge/server/.token`, и без токена код не принимает.
- Плагин выполняет присланный код в открытом файле — это полный доступ к файлу. Запускайте его только там, где разрешаете
  править, и закрывайте в остальных файлах.
- Плагину разрешена сеть только до `http://localhost:7787`.
- Слои и картинки, которые Claude читает из файла, попадают к Claude, как любое сообщение в чате.

## Советы

- Держите плагин открытым в одном файле. Если открыт в двух, задача уйдет только в файл с нужным именем, но лучше не
  проверять это на клиентских файлах.
- Перед массовыми правками Claude сохраняет версию в истории файла. Ее имя он называет в отчете.
- Положите в папку проекта файл с правилами, например `PROJECT-RULES.md`: откуда брать цены, какой шаг отступов, как
  строить фирменные плашки. Пример лежит в
  [project-rules-example.md](plugins/figma-bridge/skills/figma-bridge/references/project-rules-example.md).

## Ограничения

- Комментарии Figma плагину не видны: присылайте их скринами.
- Порт 7787 записан в манифесте плагина (`devAllowedDomains`). Если меняете порт, поменяйте и манифест.
- На бесплатном тарифе Figma в файле максимум 3 страницы. Разделы делайте секциями.
- После перезагрузки компьютера сервер выключен. Claude запускает его сам, когда видит, что мост не отвечает.

## English

A Claude Code skill and plugin that lets Claude edit live Figma files through a local development plugin: a tiny Node
server relays JavaScript from Claude to the plugin, the plugin runs it with the full Plugin API and returns JSON and PNG
exports that Claude inspects. Jobs are routed by file name, so a plugin left open in another file never receives them.
Includes a script runner, helpers, a workflow for applying client comments and a list of real-world gotchas.

Install: `curl -fsSL https://raw.githubusercontent.com/Rreerreea/claude-figma-bridge/main/install.sh | bash`
(or `/plugin marketplace add Rreerreea/claude-figma-bridge` + `/plugin install figma-bridge@claude-figma-bridge`),
then in Figma desktop import `~/Documents/Claude Bridge/manifest.json` once and restart Claude Code.

## Лицензия

MIT
