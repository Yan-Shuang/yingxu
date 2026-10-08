'use client';

import { apiFetch } from '@/lib/api';
import React, { useState, useCallback } from 'react';
import type { StageViewProps } from './types';
import MediaReview, { type ReviewItem } from './MediaReview';
import StageActions from './StageActions';
import StageProgress from './StageProgress';

type ClipItem = ReviewItem;

export default function VideoStage({ state, sessionId, onConfirm, onIntervene, onRegenerate, onUpdateArtifact, onSaveSelections, showConfirm, isRunning, referenceArtifact, hasPendingItems, hasNextStageStarted, scriptArtifact }: StageViewProps) {
  // 提取剧集标题映射
  const episodeTitleMap = React.useMemo(() => {
    const map: Record<number, string> = {};
    if (scriptArtifact?.episodes) {
      scriptArtifact.episodes.forEach((ep: { episode_number?: number; episode?: number; act_title?: string; title?: string }) => {
        // 关键修复：兼容剧本阶段的字段名
        const epNum = ep.episode_number || ep.episode;
        const epTitle = ep.act_title || ep.title;
        if (epNum) {
          map[Number(epNum)] = epTitle || '';
        }
      });
    }
    return map;
  }, [scriptArtifact]);

  // 检查每个 clip 是否有对应的参考图
  const hasReferenceImage = useCallback((clipId: string): boolean => {
    if (!referenceArtifact?.scenes) return false;
    const refScene = referenceArtifact.scenes.find((s: ReviewItem) => s.id === clipId);
    return !!(refScene?.selected || refScene?.versions?.length);
  }, [referenceArtifact]);

  // 兼容旧格式: video_clips: {Scene_1: "path"} → clips: [{id, ...}]
  const clips: ClipItem[] = (() => {
    if (state.artifact?.clips?.length) return state.artifact.clips;
    if (state.artifact?.video_clips) {
      const vc = state.artifact.video_clips as Record<string, string>;
      return Object.entries(vc)
        .sort(([a], [b]) => {
          const na = parseInt(a.replace(/\D/g, '')) || 0;
          const nb = parseInt(b.replace(/\D/g, '')) || 0;
          return na - nb;
        })
        .map(([id, path]) => ({
          id,
          name: `片段 ${id.replace('Scene_', '')}`,
          description: '',
          selected: path,
          versions: [path],
          status: 'done' as const,
        }));
    }
    return [];
  })();

  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({});
  const [editDescs, setEditDescs] = useState<Record<string, string>>({});
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const canEdit = state.status === 'waiting' || state.status === 'completed';

  // 保存单个提示词到后端 JSON
  const handleSavePrompt = async (clipId: string) => {
    const newPrompt = editDescs[clipId] ?? clips.find(item => item.id === clipId)?.description;
    if (!newPrompt) return;

    setSavingIds(prev => new Set(prev).add(clipId));
    try {
      const response = await apiFetch(`/api/project/${sessionId}/artifact/video_generation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [clipId]: { description: newPrompt }
        })
      });
      if (response.ok) {
        // 更新前端缓存的 clips.description
        if (onUpdateArtifact && state.artifact?.clips) {
          const updatedClips = state.artifact.clips.map((c: ClipItem) =>
            c.id === clipId ? { ...c, description: newPrompt } : c
          );
          onUpdateArtifact({ clips: updatedClips });
        }
        setEditingIds(prev => {
          const next = new Set(prev);
          next.delete(clipId);
          return next;
        });
        setEditDescs(prev => ({ ...prev, [clipId]: newPrompt }));
      }
    } catch (error) {
      console.error('保存提示词失败:', error);
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(clipId);
        return next;
      });
    }
  };

  // 切换编辑模式
  const handleToggleEdit = (clipId: string) => {
    setEditingIds(prev => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const handleCancelEdit = (clipId: string) => {
    const clip = clips.find(item => item.id === clipId);
    setEditDescs(prev => ({ ...prev, [clipId]: clip?.description || '' }));
    setEditingIds(prev => {
      const next = new Set(prev);
      next.delete(clipId);
      return next;
    });
  };

  const handleRegenerate = async (clipId: string) => {
    if (regeneratingIds.has(clipId)) return;
    setRegeneratingIds(prev => new Set(prev).add(clipId));
    try {
      await onIntervene({ regenerate_clips: [clipId] });
    } finally {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(clipId);
        return next;
      });
    }
  };

  const handleSelectVersion = async (clipId: string, path: string) => {
    setSelectedVersions(prev => ({ ...prev, [clipId]: path }));
    // 同步更新 artifact 以便确认时能传递正确的选中片段给阶段6
    if (onUpdateArtifact && state.artifact?.clips) {
      const updatedClips = state.artifact.clips.map((c: ClipItem) =>
        c.id === clipId ? { ...c, selected: path } : c
      );
      onUpdateArtifact({ clips: updatedClips });
    }
    // 自动保存选择
    const selections: Record<string, string> = {};
    clips.forEach(c => { selections[c.id] = selectedVersions[c.id] || c.selected; });
    selections[clipId] = path;
    if (onSaveSelections) {
      await onSaveSelections(selections);
    }
  };

  const getSelected = (clip: ClipItem) => selectedVersions[clip.id] || clip.selected;

  return (
    <div className="yx-media-stage flex flex-col h-full">
      <div className="yx-media-stage-scroll flex-1 min-w-0 overflow-y-auto">
        <div className="yx-media-stage-title"><p className="yx-eyebrow">STORIES IN MOTION</p><h2>视频创作</h2><p>让选中的画面动起来，连接故事的每一刻。</p></div>
        {state.status === 'running' && <StageProgress message={state.progressMessage} fallback="正在生成视频…" progress={state.progress} color="emerald" />}
        {state.error && <details className="yx-stage-error"><summary>本阶段暂时没有完成 · 查看原因</summary><p>{state.error}</p></details>}
        {clips.length > 0 ? (
          <MediaReview
            kind="video"
            items={clips}
            episodeTitles={episodeTitleMap}
            getSelected={getSelected}
            descriptions={editDescs}
            editingIds={editingIds}
            savingIds={savingIds}
            regeneratingIds={regeneratingIds}
            retryBlocked={id => !hasReferenceImage(id)}
            canEdit={canEdit}
            isStageRunning={state.status === 'running'}
            allowRetry={state.status !== 'pending'}
            onDescription={(id, value) => setEditDescs(prev => ({ ...prev, [id]: value }))}
            onEdit={handleToggleEdit}
            onCancel={handleCancelEdit}
            onSave={id => void handleSavePrompt(id)}
            onRetry={handleRegenerate}
            onSelect={(id, path) => void handleSelectVersion(id, path)}
          />
        ) : <div className="yx-empty"><div className="yx-empty-ring" /><h3>等待故事的下一步</h3><p>上一阶段完成后，片段会出现在这里。</p></div>}
      </div>
      <StageActions
        status={state.status} onConfirm={onConfirm} showConfirm={showConfirm}
        onRegenerate={onRegenerate} stageId="video_generation"
        hasPendingItems={hasPendingItems} hasNextStageStarted={hasNextStageStarted} isRunning={isRunning}
      />
    </div>
  );
}
