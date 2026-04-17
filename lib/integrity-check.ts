// 起動時のデータ整合性チェック。
// IndexedDB 上のデータ同士で孤児参照(削除済みエンティティを指す外部キー)が残っていないか確認し、
// 見つかった場合は修復案を返す。利用者が修復を許可すれば実際に書き戻す。
//
// 対象の孤児参照:
//   - Scene.background_illustration_id → Illustration が存在しない
//   - Scene.bgm_track_id → BgmTrack が存在しない
//   - SceneDialogue.dialogue_id → Dialogue が存在しない(= 削除)
//   - SceneDialogue.se_id → SoundEffect が存在しない
//   - SceneCastMember.character_id → Character が存在しない
//   - SceneCastMember.idle_expression_id → Expression が存在しない
//   - Dialogue.character_id → Character が存在しない(ナレーション化)
//   - Dialogue.audio_id → AudioFile が存在しない
//   - Dialogue.expression_id → Expression が存在しない
//   - Scene.video_id → Video が存在しない(未分類化)

import type {
  Scene,
  Dialogue,
  SceneDialogue,
  SceneCastMember,
  BgmTrack,
  SoundEffect,
  Illustration,
  Character,
  CharacterExpression,
  AudioFile,
  Video,
} from '@/types/db'
import {
  deleteSceneCastMember,
  deleteSceneDialogue,
  saveDialogue,
  saveScene,
  saveSceneCastMember,
} from '@/lib/db'

export interface IntegrityReport {
  // 検出数合計
  total: number
  // 修復対象: 該当行を書き戻すためのプラン
  sceneBgFix: Scene[] // background_illustration_id = null
  sceneBgmFix: Scene[] // bgm_track_id = null
  sceneVideoFix: Scene[] // video_id = null
  dialogueCharFix: Dialogue[] // character_id = null, notes='narration'
  dialogueAudioFix: Dialogue[] // audio_id = null
  dialogueExprFix: Dialogue[] // expression_id = null
  sdDeleteIds: string[] // SceneDialogue を丸ごと削除
  sdSeFix: SceneDialogue[] // se_id = null
  castDeleteIds: string[] // SceneCastMember 丸ごと削除
  castExprFix: SceneCastMember[] // idle_expression_id = null
}

export function checkIntegrity(data: {
  scenes: Scene[]
  dialogues: Dialogue[]
  sceneDialogues: SceneDialogue[]
  sceneCast: SceneCastMember[]
  characters: Character[]
  expressions: CharacterExpression[]
  audioFiles: AudioFile[]
  illustrations: Illustration[]
  bgmTracks: BgmTrack[]
  sounds: SoundEffect[]
  videos: Video[]
}): IntegrityReport {
  const illustIds = new Set(data.illustrations.map((i) => i.id))
  const bgmIds = new Set(data.bgmTracks.map((b) => b.id))
  const videoIds = new Set(data.videos.map((v) => v.id))
  const charIds = new Set(data.characters.map((c) => c.id))
  const audioIds = new Set(data.audioFiles.map((a) => a.id))
  const exprIds = new Set(data.expressions.map((e) => e.id))
  const dialogueIdSet = new Set(data.dialogues.map((d) => d.id))
  const seIds = new Set(data.sounds.map((s) => s.id))

  const report: IntegrityReport = {
    total: 0,
    sceneBgFix: [],
    sceneBgmFix: [],
    sceneVideoFix: [],
    dialogueCharFix: [],
    dialogueAudioFix: [],
    dialogueExprFix: [],
    sdDeleteIds: [],
    sdSeFix: [],
    castDeleteIds: [],
    castExprFix: [],
  }

  const now = new Date().toISOString()

  for (const s of data.scenes) {
    if (s.background_illustration_id && !illustIds.has(s.background_illustration_id)) {
      report.sceneBgFix.push({ ...s, background_illustration_id: null, updated_at: now })
    }
    if (s.bgm_track_id && !bgmIds.has(s.bgm_track_id)) {
      report.sceneBgmFix.push({ ...s, bgm_track_id: null, updated_at: now })
    }
    if (s.video_id && !videoIds.has(s.video_id)) {
      report.sceneVideoFix.push({ ...s, video_id: null, updated_at: now })
    }
  }

  for (const d of data.dialogues) {
    if (d.character_id && !charIds.has(d.character_id)) {
      report.dialogueCharFix.push({
        ...d,
        character_id: null,
        audio_id: null,
        expression_id: null,
        notes: 'narration',
        updated_at: now,
      })
      continue // 以降のチェックは不要(一括リセット)
    }
    if (d.audio_id && !audioIds.has(d.audio_id)) {
      report.dialogueAudioFix.push({ ...d, audio_id: null, updated_at: now })
    }
    if (d.expression_id && !exprIds.has(d.expression_id)) {
      report.dialogueExprFix.push({ ...d, expression_id: null, updated_at: now })
    }
  }

  for (const sd of data.sceneDialogues) {
    if (!dialogueIdSet.has(sd.dialogue_id)) {
      report.sdDeleteIds.push(sd.id)
      continue
    }
    if (sd.se_id && !seIds.has(sd.se_id)) {
      report.sdSeFix.push({ ...sd, se_id: null })
    }
  }

  for (const c of data.sceneCast) {
    if (!charIds.has(c.character_id)) {
      report.castDeleteIds.push(c.id)
      continue
    }
    if (c.idle_expression_id && !exprIds.has(c.idle_expression_id)) {
      report.castExprFix.push({ ...c, idle_expression_id: null })
    }
  }

  report.total =
    report.sceneBgFix.length +
    report.sceneBgmFix.length +
    report.sceneVideoFix.length +
    report.dialogueCharFix.length +
    report.dialogueAudioFix.length +
    report.dialogueExprFix.length +
    report.sdDeleteIds.length +
    report.sdSeFix.length +
    report.castDeleteIds.length +
    report.castExprFix.length

  return report
}

// レポートに基づいて実際に DB を修復する。成功件数を返す。
export async function applyIntegrityRepair(report: IntegrityReport): Promise<number> {
  let count = 0
  for (const s of [
    ...report.sceneBgFix,
    ...report.sceneBgmFix,
    ...report.sceneVideoFix,
  ]) {
    await saveScene(s)
    count++
  }
  for (const d of [
    ...report.dialogueCharFix,
    ...report.dialogueAudioFix,
    ...report.dialogueExprFix,
  ]) {
    await saveDialogue(d)
    count++
  }
  for (const id of report.sdDeleteIds) {
    await deleteSceneDialogue(id)
    count++
  }
  for (const sd of report.sdSeFix) {
    await import('@/lib/db').then(({ saveSceneDialogue }) => saveSceneDialogue(sd))
    count++
  }
  for (const id of report.castDeleteIds) {
    await deleteSceneCastMember(id)
    count++
  }
  for (const c of report.castExprFix) {
    await saveSceneCastMember(c)
    count++
  }
  return count
}
