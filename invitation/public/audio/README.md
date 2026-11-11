# Background music

Drop a **licensed** track here (e.g. `theme.mp3`, ideally < 3 MB, loop-friendly)
and point the app at it:

```
NEXT_PUBLIC_MUSIC_SRC=/audio/theme.mp3
```

When no track is configured the invitation plays a soft generative ambient
score synthesised in the browser (see `src/hooks/useMusic.ts`), so music works
out of the box without shipping any audio file.
