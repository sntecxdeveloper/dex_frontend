import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { KnowledgeArticle } from '../../types';
import * as knowledgeApi from '../../api/knowledgeApi';

interface KnowledgeState {
  articles: KnowledgeArticle[];
  selected: KnowledgeArticle | null;
  loading: boolean;
  error: string | null;
}

const initialState: KnowledgeState = {
  articles: [],
  selected: null,
  loading: false,
  error: null,
};

export const fetchArticles = createAsyncThunk(
  'knowledge/fetchAll',
  async (params?: { search?: string; category?: string }) => {
    return await knowledgeApi.getArticles(params);
  }
);

export const fetchArticleById = createAsyncThunk('knowledge/fetchById', async (id: number) => {
  return await knowledgeApi.getArticleById(id);
});

const knowledgeSlice = createSlice({
  name: 'knowledge',
  initialState,
  reducers: {
    clearSelected(state) {
      state.selected = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchArticles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchArticles.fulfilled, (state, action: PayloadAction<KnowledgeArticle[]>) => {
        state.articles = action.payload;
        state.loading = false;
      })
      .addCase(fetchArticles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch articles';
      })
      .addCase(fetchArticleById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchArticleById.fulfilled, (state, action: PayloadAction<KnowledgeArticle>) => {
        state.selected = action.payload;
        state.loading = false;
      })
      .addCase(fetchArticleById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch article';
      });
  },
});

export const { clearSelected } = knowledgeSlice.actions;
export default knowledgeSlice.reducer;
