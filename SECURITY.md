# Security Policy

## Supported Versions

RapidTicket is currently in active development. Security fixes are applied to the latest version only.

| Version | Supported |
|---|---|
| Latest (`main`) | ✅ |
| Older releases | ❌ |

---

## Scope

RapidTicket is designed to run **exclusively on a trusted local area network (LAN)**. It is not intended to be exposed to the public internet. As such:

- **In-scope**: authentication bypasses, privilege escalation, SQL injection, unsafe deserialization, secrets leaking via API responses.
- **Out-of-scope**: attacks that require the attacker to already have physical access to the LAN or the server machine, and general network-level attacks (e.g. ARP spoofing) that are outside the application's control.

---

## Reporting a Vulnerability

Please **do not** open a public GitHub Issue for security vulnerabilities.

Report vulnerabilities privately by emailing the maintainer directly. You can find contact details on the GitHub profile of the repository owner.

Include the following in your report:

- A clear description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You can expect an acknowledgement within **72 hours** and a status update within **7 days**.

---

## Disclosure Policy

We follow a **coordinated disclosure** model. Please allow reasonable time to patch before any public disclosure. We will credit reporters in the release notes unless you prefer to remain anonymous.
