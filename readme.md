# [Mermaid Preview](https://mermaid-preview.com)

This is a Slack app that renders [Mermaid](https://mermaid-js.github.io/mermaid/#/) diagrams in Slack.

This app adds a `/mermaid` command to your Slack workspace. You can use it to post Mermaid diagrams in Slack messages.

<a href="https://slack.com/oauth/v2/authorize?client_id=4169357715463.5791098787063&scope=channels:join,chat:write,commands,files:write,im:write&user_scope="><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>

![Mermaid Preview screenshot](public/images/mermaid-for-slack-preview-screenshot.jpg)

## How it works

The app listens for a `/mermaid` command and opens a Slack modal where you can enter your Mermaid diagram code. After you submit the modal, the app renders the diagram using [Mermaid CLI](https://github.com/mermaid-js/mermaid-cli) into a PNG file. This PNG is uploaded to Slack and posted as a message. PNG is deleted from the server after it's posted.

## Wishlist

- [ ] Edit already posted diagram (through Modal?)
- [ ] Automatically detect Mermaid diagrams in messages and render them?
- [ ] Live preview of the mermaid document in the modal? Seems like this can't be done with Slack's UI limitations.
