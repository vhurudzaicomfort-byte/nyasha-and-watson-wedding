# Background music

`those-eyes-chorus.m4a` (AAC 160k) and `those-eyes-chorus.mp3` (fallback) hold the
chorus of "Those Eyes" by New West, cut from 1:44.6–2:19.6 of the recording the
couple supplied and levelled to -16 LUFS (peaks -6.7 dBFS). Only the owner can
confirm playback rights for this recording.

How it plays (settings in `src/invitations/our-love-story.ts`, engine in
`src/hooks/useMusic.ts`):

- Starts when the guest taps "Open invitation" (with "Play music" ticked), from
  the instrumental lead-in, fading in over 3 s into "Cause' all of the small things".
- Loops on the beat: each pass starts at 1.4 s and cross-fades in over 2 s as the
  previous one reaches 31.4 s. The rhythm lines up at exactly 30.00 s, measured
  from the recording.
- Pause fades out and freezes in place; play resumes where it stopped. Mute is
  instant. Volume and fades use Web Audio gain, so they also work on iPhone.
- If Web Audio can't decode the file, a plain looping `<audio>` takes over.

To change the track, replace the two files (same cut in both) and update
`loopIn` / `loopAt` in the invitation config.
