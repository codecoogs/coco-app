# Static assets

Files in `public/` are served from the site root. Use these folders to keep things organized:

| Folder              | Use for                                    | Example URLs                                              |
| ------------------- | ------------------------------------------ | --------------------------------------------------------- |
| **`images/logos/`** | Club logo, mascot logo, main branding      | `/images/logos/club-logo.svg`, `/images/logos/mascot.svg` |
| **`images/icons/`** | Discord logo, social icons, small graphics | `/images/icons/discord.svg`                               |

Reference in code:

- **Next.js Image:** `<Image src="/images/logos/club-logo.svg" alt="Club" width={120} height={40} />`
- **Regular img:** `<img src="/images/icons/discord.svg" alt="Discord" />`
- **CSS background:** `url('/images/logos/mascot.svg')`

No need to import; use paths starting with `/`.
