## ADDED Requirements

### Requirement: Provider tabs
A tab containing only one provider's torrents SHALL be an ordinary saved-query tab whose query is
`provider:<id>`, optionally ANDed with more predicates. The UI SHALL offer "Create tab" for each provider (in
the Providers settings section and in the provider glyph's menu in the list), creating a tab named after the
provider with query `provider:<id>` without activating it; if a tab with exactly that query exists, the UI
SHALL activate it instead of creating a duplicate. Provider tabs SHALL keep their query when the provider is
renamed, and SHALL list nothing once the provider is deleted.

#### Scenario: Create a provider tab
- **WHEN** the user chooses "Create tab" on provider `nas` named "NAS"
- **THEN** a tab "NAS" with query `provider:nas` appears with its live count, and the active tab is unchanged

#### Scenario: Existing provider tab
- **WHEN** a tab with query `provider:nas` exists and the user chooses "Create tab" on `nas` again
- **THEN** no new tab is created and the existing tab is activated

#### Scenario: Provider tab with more scope
- **WHEN** the user saves the lens `provider:nas state:seeding` as a tab
- **THEN** the tab lists only seeding torrents of `nas`
