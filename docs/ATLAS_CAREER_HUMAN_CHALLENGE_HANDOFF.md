# Human challenge handoff

The user is willing to complete a CAPTCHA or similar challenge themselves. For a future employer-permitted application adapter, a provider challenge must create `human_action_required` and pause the attempt. Atlas must present the authentic employer challenge to the signed-in user. It must not solve, outsource, bypass, or automatically retry the challenge.

After the user completes it, the adapter must verify that the permitted provider flow can continue, then re-evaluate the standing policy, site capability, application answers, daily cap, and prior-attempt state. Completing a challenge alone does not authorize browser automation or submission, and it is not evidence that an application was submitted.

This phase only adds the fail-closed policy outcome, blocker, tests, and status copy. There is still no browser executor, application POST adapter, policy activation route, or live CAPTCHA handoff screen.
