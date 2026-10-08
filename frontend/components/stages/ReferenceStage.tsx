'use client';

import { apiFetch } from '@/lib/api';
import React, { useState } from 'react';
import type { StageViewProps } from './types';
import MediaReview, { type ReviewItem } from './MediaReview';
import StageActions from './StageActions';
import StageProgress from './StageProgress';
import { uploadArtifactImage } from '@/lib/workflowApi';

type SceneItem = ReviewItem;

export default function ReferenceStage({ state, sessionId, onConfirm, onIntervene, onRegenerate, onUpdateArtifact, onSaveSelections, showConfirm, isRunning, hasPendingItems, hasNextStageStarted, scriptArtifact }: StageViewProps) {
  const [editDescs, setEditDescs] = useState<Record<string, string>>({});
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({});
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());

  // 提取剧集标题映射
  const episodeTitleMap = React.useMemo(() => {
    const map: Record<number, string> = {};
    if (scriptArtifact?.episodes) {
      scriptArtifact.episodes.forEach((ep: { episode_number?: number; episode?: number; act_title?: string; title?: string }) => {
        // 关键修复：这里的字段名应该是 episode_number 和 act_title
        const epNum = ep.episode_number || ep.episode;
        const epTitle = ep.act_title || ep.title;
        if (epNum) {
          map[Number(epNum)] = epTitle || '';
        }
      });
    }
    return map;
  }, [scriptArtifact]);

  const getSelected = (scene: SceneItem) => selectedVersions[scene.id] || scene.selected;

  // 兼容旧格式: scene_images: {Scene_1: "path"} → scenes: [{id, ...}]
  const scenes: SceneItem[] = (() => {
    if (state.artifact?.scenes?.length) return state.artifact.scenes;
    if (state.artifact?.scene_images) {
      const si = state.artifact.scene_images as Record<string, string>;
      return Object.entries(si)
        .sort(([a], [b]) => {
          const na = parseInt(a.replace(/\D/g, '')) || 0;
          const nb = parseInt(b.replace(/\D/g, '')) || 0;
          return na - nb;
        })
        .map(([id, path]) => ({
          id,
          name: `场景 ${id.replace('Scene_', '')}`,
          description: '',
          selected: path,
          versions: [path],
          status: 'done' as const,
        }));
    }
    return [];
  })();

  const canEdit = state.status === 'waiting' || state.status === 'completed';

  // 保存单个提示词到后端 JSON
  const handleSavePrompt = async (sceneId: string) => {
    const newPrompt = editDescs[sceneId] ?? scenes.find(item => item.id === sceneId)?.description;
    if (!newPrompt) return;

    setSavingIds(prev => new Set(prev).add(sceneId));
    try {
      // 调用后端 API 保存提示词
      const response = await apiFetch(`/api/project/${sessionId}/artifact/reference_generation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: scenes.map(s => ({
            segment_id: s.id,
            visual_prompt: s.id === sceneId ? newPrompt : s.description
          }))
        })
      });
      if (response.ok) {
        // 保存成功后关闭编辑模式
        setEditingIds(prev => {
          const next = new Set(prev);
          next.delete(sceneId);
          return next;
        });
        // 更新本地状态，使用保存后的值
        setEditDescs(prev => ({ ...prev, [sceneId]: newPrompt }));
        // 同步更新 artifact 以便后续阶段能获取最新的提示词
        if (onUpdateArtifact && state.artifact?.scenes) {
          const updatedScenes = state.artifact.scenes.map((s: SceneItem) =>
            s.id === sceneId ? { ...s, description: newPrompt } : s
          );
          onUpdateArtifact({ scenes: updatedScenes });
        }
      }
    } catch (error) {
      console.error('保存提示词失败:', error);
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  // 切换编辑模式
  const handleToggleEdit = (sceneId: string) => {
    setEditingIds(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  const handleCancelEdit = (sceneId: string) => {
    const scene = scenes.find(item => item.id === sceneId);
    setEditDescs(prev => ({ ...prev, [sceneId]: scene?.description || '' }));
    setEditingIds(prev => {
      const next = new Set(prev);
      next.delete(sceneId);
      return next;
    });
  };

  const handleUploadImage = async (sceneId: string, file: File) => {
    setUploadingIds(prev => new Set(prev).add(sceneId));
    try {
      const result = await uploadArtifactImage(sessionId, 'reference_generation', 'scenes', sceneId, file);
      if (result.artifact?.scenes) {
        onUpdateArtifact?.({ scenes: result.artifact.scenes });
      }
      setSelectedVersions(prev => ({ ...prev, [sceneId]: result.path }));
    } catch (error) {
      console.error('上传图片失败:', error);
    } finally {
      setUploadingIds(prev => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  const handleRegenerate = async (sceneId: string) => {
    if (regeneratingIds.has(sceneId)) return;
    setRegeneratingIds(prev => new Set(prev).add(sceneId));
    try {
      await onIntervene({ regenerate_scenes: [sceneId] });
    } finally {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  const handleSelectVersion = async (sceneId: string, path: string) => {
    setSelectedVersions(prev => ({ ...prev, [sceneId]: path }));
    // 同步更新 artifact 以便确认时能传递正确的选中图片给阶段5
    if (onUpdateArtifact && state.artifact?.scenes) {
      const updatedScenes = state.artifact.scenes.map((s: SceneItem) =>
        s.id === sceneId ? { ...s, selected: path } : s
      );
      onUpdateArtifact({ scenes: updatedScenes });
    }
    // 自动保存选择
    const selections: Record<string, string> = {};
    scenes.forEach(s => { selections[s.id] = selectedVersions[s.id] || s.selected; });
    selections[sceneId] = path;
    if (onSaveSelections) {
      await onSaveSelections(selections);
    }
  };

  return (
    <div className="yx-media-stage flex flex-col h-full">
      <div className="yx-media-stage-scroll flex-1 min-w-0 overflow-y-auto">
        <div className="yx-media-stage-title"><p className="yx-eyebrow">FRAMES TAKE SHAPE</p><h2>参考图创作</h2><p>选择画面，调整描述，逐帧打磨你的故事。</p></div>
        {state.status === 'running' && <StageProgress message={state.progressMessage} fallback="正在生成参考图…" progress={state.progress} color="emerald" />}
        {state.error && <details className="yx-stage-error"><summary>本阶段暂时没有完成 · 查看原因</summary><p>{state.error}</p></details>}
        {scenes.length > 0 ? (
          <MediaReview
            kind="image"
            items={scenes}
            episodeTitles={episodeTitleMap}
            getSelected={getSelected}
            descriptions={editDescs}
            editingIds={editingIds}
            savingIds={savingIds}
            regeneratingIds={regeneratingIds}
            uploadingIds={uploadingIds}
            onUpload={(id, file) => void handleUploadImage(id, file)}
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
        onRegenerate={onRegenerate} stageId="reference_generation"
        hasPendingItems={hasPendingItems} hasNextStageStarted={hasNextStageStarted} isRunning={isRunning}
      />
    </div>
  );
}
