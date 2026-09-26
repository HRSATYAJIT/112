# Generates the static marketing/policy pages in public/ from one shared shell.
# Run: python3 scripts/build-pages.py
import pathlib, html
OUT = pathlib.Path(__file__).resolve().parent.parent / "public"
OWNER = "Satyajit Tripathy"
EMAIL = "satyaxlri14@gmail.com"
PHONE = "+91 73381 07498"
WA = "917338107498"
UPI = "7761830260@pthdfc"
UPDATED = "26 September 2026"

def shell(slug, title, desc, body, noindex=False):
    links = [("index.html", "Calculator"), ("index.html#letter", "Offer letters"), ("pricing.html", "Pricing"), ("contact.html", "Contact")]
    cur, cta = ' aria-current="page"', ' class="cta"'
    nav = "".join(f'<a href="{h}"{cur if h == slug + ".html" else ""}{cta if h == "pricing.html" else ""}>{t}</a>' for h, t in links)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
{'<meta name="robots" content="noindex">' if noindex else ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="site.css">
</head>
<body>
<div class="wrap">
<header class="nav"><a class="logo" href="index.html"><span class="mark">CF</span><b>CTCfix</b></a><nav class="links">{nav}</nav></header>
{body}
<footer class="site"><span>© 2026 CTCfix · Operated by {OWNER}, sole proprietor, Bengaluru</span>
<nav><a href="pricing.html">Pricing</a><a href="terms.html">Terms</a><a href="privacy.html">Privacy</a><a href="refund.html">Refunds &amp; cancellation</a><a href="contact.html">Contact</a></nav></footer>
</div>
</body>
</html>
"""

def plan(name, price, who, feats, qr, amt, tag, featured=False):
    lis = "".join(f"<li>{f}</li>" for f in feats)
    wa = f"https://wa.me/{WA}?text=" + ("Hi%2C%20I%20paid%20%E2%82%B9" + str(amt) + "%20for%20the%20CTCfix%20" + tag + "%20plan.%20Screenshot%20attached.%20Company%20name%3A%20")
    upi = f"upi://pay?pa={UPI}&pn=SATYAJIT%20TRIPATHY&am={amt}.00&cu=INR&tn=CTCfix%20{tag}%20plan"
    return f"""<article class="card plan{' featured' if featured else ''}" id="{tag.lower()}">
  <div class="phead"><span class="label">{name}</span><div class="price"><b>₹{price}</b><span>/month</span></div><p class="who">{who}</p></div>
  <ul class="feats">{lis}</ul>
  <div class="pay">
    <img src="{qr}" alt="UPI QR code to pay ₹{price} to {OWNER}" width="168" height="168">
    <div class="steps">
      <ol>
        <li>Scan with any UPI app, or <a href="{upi}">tap to pay on your phone</a>. UPI ID <code>{UPI}</code>.</li>
        <li><a href="{wa}" target="_blank" rel="noopener">Send the payment screenshot on WhatsApp</a>.</li>
        <li>Get your access code within 2 hours (9 AM–9 PM IST) and enter it on the Offer letters tab.</li>
      </ol>
    </div>
  </div>
</article>"""

pricing_css = """<style>
.plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}
@media (max-width:900px){.plans{grid-template-columns:1fr}}
.plan{padding:22px;display:flex;flex-direction:column;gap:16px}
.plan.featured{border:2px solid var(--accent)}
.price{display:flex;align-items:baseline;gap:4px;margin:8px 0 4px}
.price b{font:600 34px/1 var(--mono);letter-spacing:-.02em}
.price span{color:var(--muted)}
.who{margin:0;color:var(--muted);font-size:14px}
.feats{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:14.5px}
.pay{display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--line);padding-top:16px}
.pay img{background:#fff;border-radius:10px;padding:8px;border:1px solid var(--line);align-self:flex-start;max-width:100%;height:auto}
.steps ol{margin:0;padding-left:18px;font-size:13.5px;display:flex;flex-direction:column;gap:6px}
code{font:500 12.5px var(--mono);background:var(--surface-2);padding:2px 5px;border-radius:5px;white-space:nowrap}
.free .btn{align-self:flex-start}
.faq{max-width:70ch}
.faq h3{font:600 15.5px/1.35 var(--sans);margin:20px 0 4px}
.faq p{margin:0;color:var(--muted)}
.note{font-size:13px;color:var(--muted);margin-top:14px}
</style>"""

pricing = pricing_css + f"""
<h1>Simple monthly plans. Cancel anytime.</h1>
<p class="lede">The salary calculator is free for everyone. A plan unlocks offer and appointment letters drafted by Claude, with PDF download and a compliant Annexure A.</p>
<div class="plans">
<article class="card plan free">
  <div class="phead"><span class="label">Free</span><div class="price"><b>₹0</b></div><p class="who">For checking any salary structure</p></div>
  <ul class="feats"><li>Labour Code salary structure for Karnataka, Maharashtra, Telangana, Haryana and Tamil Nadu</li><li>PF, ESI, gratuity, professional tax and LWF</li><li>Compliance checks and old-vs-new comparison</li><li>Offer letter preview (watermarked)</li></ul>
  <a class="btn ghost" href="index.html">Open the calculator</a>
</article>
{plan("SME", "399", "For one company's own hiring", ["Everything in Free", "Unlimited offer and appointment letters for your company", "Letters drafted by Claude, salary figures from the calculator", "PDF download and copy", "WhatsApp support"], "upi-sme.svg", 399, "SME", True)}
{plan("CA and consultants", "2,299", "For CAs and HR consultants serving many clients", ["Everything in SME", "Use for any number of client companies", "Priority WhatsApp support, same business day"], "upi-ca.svg", 2299, "CA")}
</div>
<p class="note">Prices are in Indian rupees and are final. Each payment covers access until the end of the following calendar month. Access is personal to the paying business.</p>

<section class="faq">
<h2>Questions</h2>
<h3>Why do I pay by UPI and get a code?</h3><p>Card payments and auto-renewal are coming soon. Until then, UPI is the fastest way to start today. Your code works immediately on the Offer letters tab.</p>
<h3>Are the calculations checked?</h3><p>Rates for PF, ESI, gratuity, professional tax and labour welfare fund are verified as of 26 September 2026. Minimum wage and income tax are not calculated yet. Review figures with your payroll adviser before issuing letters.</p>
<h3>Can I get a refund?</h3><p>Yes, within 7 days of your first payment. See the <a href="refund.html">refund policy</a>.</p>
<h3>Do you need an invoice?</h3><p>Email <a href="mailto:{EMAIL}">{EMAIL}</a> with your business name and we'll send a payment receipt.</p>
</section>"""

terms = f"""<div class="prose">
<h1>Terms of service</h1>
<p class="updated">Last updated {UPDATED}</p>
<p>CTCfix (ctcfix.org) is operated by {OWNER}, a sole proprietor based in Bengaluru, Karnataka ("we", "us"). By using CTCfix you agree to these terms.</p>
<h2>The service</h2>
<p>CTCfix calculates salary structures under India's Labour Codes and state rules, and drafts employment letters. The free calculator is open to everyone. Paid plans unlock letter drafting and downloads for the period you pay for.</p>
<h2>Not legal or tax advice</h2>
<p>CTCfix is a calculation and drafting tool. It does not give legal, tax or payroll advice. Statutory rates change, and rules such as minimum wages vary by schedule and zone. You are responsible for reviewing every figure and letter before you use it, and for your compliance with applicable law.</p>
<h2>Plans and payment</h2>
<ul><li>SME plan: ₹399 per month, for one business's own employees.</li><li>CA and consultants plan: ₹2,299 per month, for use across client companies.</li><li>Each payment gives access until the end of the following calendar month. Plans do not renew automatically.</li><li>Access codes are for the paying business only and must not be shared publicly.</li></ul>
<h2>Acceptable use</h2>
<p>Do not misuse the service, attempt to bypass access controls, or use it to produce misleading documents. We may suspend access that breaks these terms.</p>
<h2>Your content</h2>
<p>You keep ownership of the details you enter and the letters you create. See the <a href="privacy.html">privacy policy</a> for how we handle data.</p>
<h2>Liability</h2>
<p>The service is provided as is. To the extent permitted by law, our total liability for any claim is limited to the amount you paid us in the month before the claim.</p>
<h2>Changes and governing law</h2>
<p>We may update these terms and will post changes on this page. These terms are governed by the laws of India, and courts in Bengaluru, Karnataka have jurisdiction.</p>
<h2>Contact</h2>
<p>{EMAIL} · {PHONE}</p>
</div>"""

privacy = f"""<div class="prose">
<h1>Privacy policy</h1>
<p class="updated">Last updated {UPDATED}</p>
<p>This policy explains how CTCfix, operated by {OWNER}, handles your information, in line with the Digital Personal Data Protection Act, 2023.</p>
<h2>What stays in your browser</h2>
<p>Salary figures you enter in the calculator are processed in your browser and are not sent to us. Company details you type on the Offer letters tab and your access code are saved in your own browser so you don't retype them. You can clear them by clearing your browser's site data.</p>
<h2>What we process</h2>
<ul><li><b>Letter drafting.</b> When you draft a letter, the company, employee and terms details you entered are sent to our server and to Anthropic's Claude API to write the letter text. Salary figures are not sent. We do not store the letter or these details after the response is returned.</li><li><b>Payments.</b> When you pay by UPI and message us on WhatsApp, we receive your name, phone number, payment reference and business name. We keep these to issue access codes, provide support and meet tax record-keeping rules.</li><li><b>Hosting logs.</b> Our host, Vercel, keeps standard technical logs such as IP address and request times for security.</li></ul>
<h2>What we don't do</h2>
<p>We do not sell your data or use it for advertising.</p>
<h2>Your rights</h2>
<p>You can ask to see, correct or delete the personal data we hold about you. Email {EMAIL}. We respond within 7 days.</p>
<h2>Grievance officer</h2>
<p>{OWNER} · {EMAIL} · {PHONE}</p>
</div>"""

refund = f"""<div class="prose">
<h1>Refunds and cancellation</h1>
<p class="updated">Last updated {UPDATED}</p>
<h2>7-day refund on your first payment</h2>
<p>If CTCfix isn't right for you, ask for a refund within 7 days of your first payment and we'll refund it in full. No questions asked.</p>
<h2>Cancelling</h2>
<p>Plans do not renew automatically, so there is nothing to cancel. If you don't pay for the next period, access ends when your current code expires. Renewal payments after the first are not refundable for a partly used period.</p>
<h2>How refunds are paid</h2>
<p>We refund to the UPI account or bank account you paid from, within 5 to 7 working days of approving the request.</p>
<h2>Delivery</h2>
<p>CTCfix is a digital service. There is nothing shipped. Your access code is sent on WhatsApp or email within 2 hours of payment between 9 AM and 9 PM IST, and within the next morning otherwise.</p>
<h2>Request a refund</h2>
<p>Email {EMAIL} or WhatsApp {PHONE} with your payment reference.</p>
</div>"""

contact = f"""<div class="prose">
<h1>Contact</h1>
<p class="lede">Questions about a salary structure, a letter or your plan? Reach us directly.</p>
<div class="card" style="padding:20px;display:grid;gap:14px">
<div><span class="label">WhatsApp and phone</span><p style="margin:6px 0 0"><a href="https://wa.me/{WA}" target="_blank" rel="noopener">{PHONE}</a></p></div>
<div><span class="label">Email</span><p style="margin:6px 0 0"><a href="mailto:{EMAIL}">{EMAIL}</a></p></div>
<div><span class="label">Hours</span><p style="margin:6px 0 0">9 AM to 9 PM IST, Monday to Saturday</p></div>
<div><span class="label">Operated by</span><p style="margin:6px 0 0">{OWNER}, sole proprietor<br>Bengaluru, Karnataka, India</p></div>
</div>
</div>"""

pages = {
  "pricing": ("CTCfix Pricing", "CTCfix plans: free salary calculator, ₹399/month SME plan and ₹2,299/month CA plan for Labour Code compliant offer letters.", pricing),
  "terms": ("CTCfix Terms of Service", "Terms of service for CTCfix.", terms),
  "privacy": ("CTCfix Privacy Policy", "How CTCfix handles your data.", privacy),
  "refund": ("CTCfix Refunds and Cancellation", "Refund, cancellation and delivery policy for CTCfix.", refund),
  "contact": ("Contact CTCfix", "Contact CTCfix by WhatsApp or email.", contact),
}
for slug, (t, d, b) in pages.items():
    (OUT / f"{slug}.html").write_text(shell(slug, t, d, b))
print("built", ", ".join(f"{s}.html" for s in pages))
