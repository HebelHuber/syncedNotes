# Contributing

I'm more than welcome to look over pull requests, though I don't expect too many of them. I would like to make sure everyone knows the following:

1. I am purposefully _not_ adding any of my own UI to VSCode. VSCode handles most of my day-to-date use cases, and while I think their API could be improved I am not planning on making this extension into another GitLens (though if requested I may look into a way to interface with GitLens).
2. I'm all about the best user experience, so point #1 may be forgotten if I receive enough feedback that the UX is bad.

## Issues

Please be as clear as possible when creating an issue. Err on the side of "too much information" instead of "Extension doesn't work." Screenshots will always be welcome.

## Merge requests

Please follow the Angular style commits. While it is not my favorite commit style, I think I'd experience a small anarchistic uprising if I didn't use it for this project.

To recap, that is at minimum: `<type>(<scope?>): <summary>`

A full commit would look something like

```
<type>(<scope?>): <summary>

<description> (can be multiple lines)

<footer>
```

Please note that `<footer>` should look something like: 

> Closes #11, #14
> Implements #12

Where `#11`, `#14`, and `#12` are Issue IDs from the issue board.

### Branch naming

I like to use the type as the first part of the ticket, followed by a forward slash, and a quick description of the specific goal the branch is targeting. 

For example:

`feat/move-to-map-for-type-settings`
`fix/undefined-error-on-escape-in-subject`

Really, just use a good descriptive name for the branch is all I ask.