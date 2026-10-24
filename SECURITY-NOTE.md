# About the GitHub token — read before you paste

## What I will do with it
Right now, nothing — I have not received it. When you paste it, I will:

1. Verify it with `GET /user` (the only call that reveals who it belongs to).
2. Create the repo `shohoj-bazar` under your account if it does not exist.
3. Push these 15 files to the `main` branch.
4. Enable GitHub Pages and give you the live URL.

That is the complete list. Nothing else.

## How to give me a token that cannot hurt you
Create a **fine-grained personal access token** (not a classic one):

1. GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained tokens** → Generate new token
2. **Resource owner:** yourself
3. **Repository access:** *Only select repositories* → pick `shohoj-bazar`
   (or *All repositories* only if you want me to create it — otherwise create the empty repo yourself first and give me access to just that one)
4. **Repository permissions:** `Contents: Read and write`, and `Pages: Read and write`
   — everything else stays **No access**
5. **Expiration:** 7 days (or 1 day)
6. Generate, copy, paste it in the chat

That token can only touch that one repo, and it dies in a week.

## Revoke it straight after
Once the site is live, go back to the same page and click **Revoke**. The site keeps working — Pages does not need the token. Revoking costs you nothing and removes the only credential that ever existed.

## What you should never paste here
- Your **GitHub password** (never needed)
- A **classic token with `repo` on all repositories** (too much power)
- Tokens for **banking, bKash, Nagad or any payment provider** — those will never be handled in chat; they belong in a secrets manager on the server, and I will set that up properly in Section 7
- Your **NID, trade licence scans, or TIN** — those go to the payment gateway's KYC portal, not to me

## If you would rather keep it private
Say so and we skip the token entirely. You create an empty repo, and I hand you a single command plus a copy-paste-ready file you upload through the GitHub website. Same result, you stay in control the whole time.
