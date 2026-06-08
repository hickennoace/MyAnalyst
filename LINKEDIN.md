# LinkedIn Post - MyAnalyst

> Copy-paste ready. Pick the English or Hebrew version below.

---

## English

Meet MyAnalyst 📊

It's a tool that turns a messy spreadsheet into an actual report in a few seconds. You drop in an Excel, CSV, or JSON file and it hands you back a clean dashboard: the data gets fixed up automatically, the important numbers get pulled out, you get real statistics and a forecast, charts are drawn for you, and everything is explained in plain language. No setup, no formulas, nothing to learn.

I built it because most BI tools are built for people who already know how to use them. I wanted the opposite: a simple app for everyone else - the people who have data and questions but no time or training to wrestle with dashboards. You give it your file, it does the work for you. That's the whole idea.

The interesting part is how it works: the whole thing runs inside your browser. Reading the file, cleaning it, figuring out what each column is, picking the right stats, running the regression and the forecast - all of it happens on your machine, in plain TypeScript. That means there's no server, no API key, and your file never leaves the page. Nothing to leak, because nothing gets sent anywhere.

The hardest part was making it genuinely smart for free, without it ever making things up. Every sentence it writes is filled in with numbers the engine actually calculated, so it can't invent a fact. There's an optional AI layer too, but it's off by default and only ever sees summary stats, never your raw data.

Built with Next.js 15, React 19, TypeScript, Tailwind, and ECharts. 190 tests, CI/CD, runs fully in the browser.
Repo: https://github.com/hickennoace/MyAnalyst
Website: https://myanalyst.net
Feedback welcome.

---

## עברית

הכירו את MyAnalyst 📊

זה כלי שלוקח קובץ נתונים מבולגן והופך אותו לדוח אמיתי תוך כמה שניות. אתה גורר קובץ Excel, CSV או JSON, ומקבל בחזרה דאשבורד נקי: הנתונים מסתדרים לבד, המספרים החשובים נשלפים החוצה, אתה מקבל סטטיסטיקה אמיתית ותחזית, הגרפים מצוירים בשבילך, והכל מוסבר בשפה פשוטה. בלי הגדרות, בלי נוסחאות, בלי שום דבר ללמוד.

בניתי אותו כי רוב כלי ה-BI בנויים לאנשים שכבר יודעים להשתמש בהם. רציתי בדיוק את ההפך: אפליקציה פשוטה לכל השאר - לאנשים שיש להם נתונים ושאלות, אבל אין להם זמן או ידע להתעסק עם דאשבורדים. אתה נותן לו את הקובץ, והוא עושה את העבודה בשבילך. זה כל הרעיון.

החלק המעניין הוא איך זה עובד: הכל רץ בתוך הדפדפן שלך. קריאת הקובץ, הניקוי, ההבנה מה כל עמודה, בחירת הסטטיסטיקה הנכונה, הרגרסיה והתחזית - הכל קורה על המחשב שלך, ב-TypeScript פשוט. כלומר אין שרת, אין מפתח API, והקובץ שלך אף פעם לא יוצא מהעמוד. אין מה לדלוף, כי שום דבר לא נשלח לשום מקום.

החלק הכי קשה היה לגרום לו להיות חכם באמת בחינם, בלי שאף פעם הוא ימציא דברים. כל משפט שהוא כותב מתמלא במספרים שהמנוע באמת חישב, ולכן הוא לא יכול להמציא עובדה. יש גם שכבת AI אופציונלית, אבל היא כבויה כברירת מחדל ורואה רק נתונים מסכמים, אף פעם לא את המידע הגולמי שלך.

נבנה עם Next.js 15, React 19, TypeScript, Tailwind ו-ECharts. 190 בדיקות, CI/CD, רץ לגמרי בדפדפן.
ריפו: https://github.com/hickennoace/MyAnalyst
אתר: https://myanalyst.net
אשמח לפידבק.
