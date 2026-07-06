import { marked } from "marked";
import fs from "fs-extra";

export class HtmlService {

    async convert(markdownFile: string, outputFile: string): Promise<void> {

        const markdown = await fs.readFile(markdownFile, "utf8");

        const articleHtml = await marked(markdown);

        const html = `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tech Blog</title>

    <style>
        body{
            font-family:Arial,Helvetica,sans-serif;
            max-width:900px;
            margin:auto;
            padding:30px;
            line-height:1.8;
        }

        pre{
            background:#f4f4f4;
            padding:15px;
            overflow:auto;
            border-radius:8px;
        }

        code{
            font-family:Consolas;
        }

        img{
            max-width:100%;
        }
    </style>

</head>

<body>

${articleHtml}

</body>

</html>
`;

        await fs.ensureDir("output/articles/html");

        await fs.writeFile(outputFile, html);

    }

}