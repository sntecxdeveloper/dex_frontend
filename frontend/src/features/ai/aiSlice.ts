import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import * as aiApi from '../../api/aiApi';

interface AiState {
  recommendation: aiApi.AiRecommendation | null;
  loading: boolean;
  error: string | null;
}

const initialState: AiState = {
  recommendation: null,
  loading: false,
  error: null,
};

export const fetchRecommendation = createAsyncThunk(
  'ai/fetchRecommendation',
  async (issueId: number) => {
    return await aiApi.getRecommendation(issueId);
  }
);

export const analyzeIssue = createAsyncThunk(
  'ai/analyzeIssue',
  async (issueId: number) => {
    return await aiApi.analyzeIssue(issueId);
  }
);

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    clearRecommendation(state) {
      state.recommendation = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecommendation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecommendation.fulfilled, (state, action: PayloadAction<aiApi.AiRecommendation>) => {
        state.recommendation = action.payload;
        state.loading = false;
      })
      .addCase(fetchRecommendation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch recommendation';
      })
      .addCase(analyzeIssue.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(analyzeIssue.fulfilled, (state, action: PayloadAction<aiApi.AiRecommendation>) => {
        state.recommendation = action.payload;
        state.loading = false;
      })
      .addCase(analyzeIssue.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to analyze issue';
      });
  },
});

export const { clearRecommendation } = aiSlice.actions;
export default aiSlice.reducer;
