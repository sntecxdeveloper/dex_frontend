import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { Remediation } from '../../types';
import * as remediationApi from '../../api/remediationApi';

interface RemediationState {
  items: Remediation[];
  loading: boolean;
  error: string | null;
}

const initialState: RemediationState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchRemediations = createAsyncThunk('remediation/fetchAll', async () => {
  return await remediationApi.getRemediations();
});

const remediationSlice = createSlice({
  name: 'remediation',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRemediations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRemediations.fulfilled, (state, action: PayloadAction<Remediation[]>) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchRemediations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch remediations';
      });
  },
});

export default remediationSlice.reducer;
