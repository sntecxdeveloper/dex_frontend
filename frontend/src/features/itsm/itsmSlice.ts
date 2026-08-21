import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { ItsmTicket } from '../../types';
import * as itsmApi from '../../api/itsmApi';

interface ItsmState {
  tickets: ItsmTicket[];
  loading: boolean;
  error: string | null;
}

const initialState: ItsmState = {
  tickets: [],
  loading: false,
  error: null,
};

export const fetchTickets = createAsyncThunk('itsm/fetchTickets', async () => {
  return await itsmApi.getTickets();
});

const itsmSlice = createSlice({
  name: 'itsm',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTickets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action: PayloadAction<ItsmTicket[]>) => {
        state.tickets = action.payload;
        state.loading = false;
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch tickets';
      });
  },
});

export default itsmSlice.reducer;
