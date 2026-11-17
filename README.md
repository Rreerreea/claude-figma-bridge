# Claude Figma Bridge

Правки макетов в Figma прямо из Claude Code — через маленький плагин-мост. Claude читает слои, меняет их через Plugin API
и сам проверяет результат по выгрузке PNG. Без Figma MCP и его лимитов, на любом тарифе Figma.

Скилл собран из реальной работы над сайтом: компоненты и дизайн-система, страницы, адаптивы, корзина и оформление заказа,
десятки правок по комментариям заказчика. В него упакован порядок работы и все грабли, на которые мы наступили.

## Что умеет

- Читать структуру фреймов: слои, автолейаут, стили, переменные. Выгружать PNG и смотреть на результат.
- Править: тексты, компоненты и варианты, автолейаут, отступы и скругления через переменные, векторы.
- Собирать рядом с макетом состояния экранов: ввод, ошибка, загрузка, успех, гость или вошел в аккаунт.
- Идти по комментариям заказчика: вы присылаете скрин коммента, Claude объясняет его, делает правку и коротко
  отчитывается.
- Вести файл задач, чтобы следующий чат продолжил с того же места.

## Что нужно

- Figma desktop: dev-плагины работают только в приложении.
- Node.js 18+ и Python 3.8+.
- Claude Code.

## Установка

Как плагин Claude Code:

```
/plugin marketplace add Rreerreea/claude-figma-bridge
/plugin install figma-bridge@claude-figma-bridge
```

Или вручную: скопировать папку `plugins/figma-bridge/skills/figma-bridge` в `~/.claude/skills/figma-bridge`.

## Первый запуск

1. Скажите Claude: «подключи фигма-мост». Он запустит сервер, и мост встанет в `~/.figma-bridge`.
   То же руками: `python3 <папка скилла>/scripts/setup.py start`.
2. В Figma desktop: Plugins → Development → Import plugin from manifest… → `~/.figma-bridge/plugin/manifest.json`.
   Это нужно сделать один раз.
3. Откройте файл, который можно править, и запустите Plugins → Development → **Claude Bridge**. Окошко не закрывайте.
4. Пишите задачу: «вот фрейм (ссылка), сделай …» или «пойдем по комментам» и скрин.

## Как это устроено

```
Claude Code ──POST /run (токен, имя файла)──▶ сервер на localhost:7787 ◀──GET /next?file=…── плагин в файле Figma
Claude Code ◀──────────── результат ───────── сервер ◀──POST /result──────────────────────── плагин
```

- `scripts/fig.py` — запускает скрипт в файле. Кириллицу переводит в ASCII, картинки сохраняет файлами, отказывается
  работать в чужом файле.
- `scripts/lib.js` — помощники: дерево слоев, PNG, переменные, тексты без потери стиля, варианты компонентов.
- `references/` — порядок работы, грабли, рецепты и пример правил проекта.

## Безопасность

- Сервер слушает только этот компьютер (localhost). При каждом запуске он пишет случайный токен в `~/.figma-bridge/.token`,
  и без токена код не принимает.
- Плагин выполняет присланный код в открытом файле — это полный доступ к файлу. Запускайте его только там, где разрешаете
  править, и закрывайте в остальных файлах.
- Плагину разрешена сеть только до `http://localhost:7787`.

## Советы

- Держите плагин открытым в одном файле. Если открыт в двух, задача уйдет только в файл с нужным именем, но лучше не
  проверять это на клиентских файлах.
- Перед массовыми правками Claude сохраняет версию в истории файла. Ее имя он называет в отчете.
- Положите в папку проекта файл с правилами, например `PROJECT-RULES.md`: откуда брать цены, какой шаг отступов, как
  строить фирменные плашки. Пример лежит в `references/project-rules-example.md`.

## Ограничения

- Комментарии Figma плагину не видны: присылайте их скринами.
- Порт 7787 записан в манифесте плагина (`devAllowedDomains`). Если меняете порт, поменяйте и манифест.
- На бесплатном тарифе Figma в файле максимум 3 страницы. Разделы делайте секциями.

## English

A Claude Code skill and plugin that lets Claude edit live Figma files through a local development plugin: a tiny Node
server relays JavaScript from Claude to the plugin, the plugin runs it with the full Plugin API and returns JSON and PNG
exports that Claude inspects. Jobs are routed by file name, so a plugin left open in another file never receives them.
Includes a script runner, helpers, a workflow for applying client comments and a list of real-world gotchas.
Install: `/plugin marketplace add Rreerreea/claude-figma-bridge`, then `/plugin install figma-bridge@claude-figma-bridge`;
import `~/.figma-bridge/plugin/manifest.json` in Figma desktop once.

## Лицензия

MIT
