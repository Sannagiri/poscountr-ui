// Deprecated: the add/edit location form is now a `view` inside
// `LocationsModal` itself (one `Modal` instance, swapping list ↔ form)
// rather than a second stacked `Modal` opened on top of it — stacking two
// independent Radix `Dialog.Root`s meant two overlays rendering at once,
// which read as a rendering bug (the list modal's edges visible behind the
// narrower form dialog) and made the list's own Edit/Deactivate/Activate
// actions unreachable-looking. See `LocationsModal.tsx`.
// Left as an inert stub — the sandbox this was built in cannot delete files.
export {};
