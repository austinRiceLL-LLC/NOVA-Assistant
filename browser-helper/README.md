# Atlas guided application helper

This is an unpacked Manifest V3 extension for Chrome or Edge. It is an early, local pilot. It does not crawl application pages, advance forms, solve challenges, upload files, or submit applications.

1. In the Atlas **Application details** tab, save and approve your answers. Click **Copy approved details for browser helper**.
2. Open the browser's Extensions page, enable Developer mode, choose **Load unpacked**, and select this `browser-helper` directory. In Edge, use its equivalent Extensions page.
3. Open an employer application page. Click the Atlas extension, paste the copied details, and click **Import pasted details**.
4. Click **Inspect visible questions**. Review the list. Click **Fill empty, matched fields** only when appropriate for that employer page. Check every answer on the page yourself.
5. You handle page changes, CAPTCHA, any file upload, unusual questions, and final submission. Reopen the popup and inspect again after each page change. Close the browser to clear the imported profile from session storage.

The extension requests `activeTab`, `scripting`, and `storage`. A click grants access to the active tab. It inspects only the top page, so fields in embedded cross-origin frames may be absent. It checks whether fields are empty, but never collects or returns existing answers or sends form data to Atlas or another server. Approved details are held in `chrome.storage.session` and only passed to the active page when **Fill** is clicked. The pasted textarea is cleared after import. Clear the system clipboard after use too.

The helper fills only empty, visible text, email, phone, URL, and textarea fields with conservative label matches. Sensitive, eligibility, demographic, salary, and narrative questions stay manual. It skips LinkedIn, Indeed, ZipRecruiter, and Handshake pages. Employer sites can still restrict automated assistance or change their forms, and using this helper cannot guarantee an account will avoid restrictions. Check each site's rules before use.
