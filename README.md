This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Copy the example environment file and add your OpenAI key if you want AI rental
sheet extraction:

```bash
copy .env.example .env.local
```

Set:

```bash
OPENAI_API_KEY=your_key_here
```

Create an API key from the OpenAI dashboard, then restart the dev server after
editing `.env.local`. The key is only used by the server route and is never sent
to the browser.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Rental Sheet Extraction

The Rentals page tries AI extraction first when the browser is online and
`OPENAI_API_KEY` is configured. The uploaded sheet photos are sent to the
server-side route at `/api/parse-rental-sheet`, which calls OpenAI and returns
normalized rental JSON for review.

If AI extraction fails, times out, the app is offline, or no key is configured,
the app falls back to the existing local Tesseract OCR/parser flow. The review
screen shows whether the result came from `AI extraction` or
`Offline OCR fallback`.

To test locally:

1. Add `OPENAI_API_KEY` to `.env.local`.
2. Run `npm run dev`.
3. Open `/rentals`, choose `Add Sheets`, select one or more sheet photos, then
   scan and review the extracted rentals.
4. To test fallback, remove the key or use DevTools Network Offline, then scan
   again.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
