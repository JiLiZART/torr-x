---
default: minor
---

# `:field value` queries and editable tab chips

The query language also accepts the prefix form `:field value` (`:size >4GB`, `!:tag x`). It means the same as
`field:value`, works everywhere a query is typed, and Spotlight no longer rewrites `:size ` into `size:`.

The active tab's own query now leads the filter bar's chip row, counts in the funnel and appears in the filter
builder. Removing, negating or editing those chips changes only what the list shows: the saved tab stays as it is,
and Clear lens or switching tabs brings it back.

The "no torrents match" breakdown follows the design: an amber funnel icon, removable tab and lens chips (funnel
for the tab, check for the lens), and shortcuts on the recovery buttons. Clear lens also appears when only tab chips
were edited.

Tabs you create are edited in place: applying the filter builder, adding or removing a chip, or clicking a column header saves the new query to the tab (⌘Z undoes it), and "Save as tab" is no longer offered there. Built-in tabs keep the lens.
