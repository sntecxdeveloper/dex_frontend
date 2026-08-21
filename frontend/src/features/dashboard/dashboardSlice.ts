import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as deviceApi from '../../api/deviceApi';
import * as issueApi from '../../api/issueApi';
import * as remediationApi from '../../api/remediationApi';
import type { Device, Issue, Remediation } from '../../types';

interface DashboardState {
  devices: Device[];
  issues: Issue[];
  remediations: Remediation[];
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  devices: [],
  issues: [],
  remediations: [],
  loading: false,
  error: null,
};

export const fetchDashboardData = createAsyncThunk('dashboard/fetchAll', async () => {
  const [devices, issues, remediations] = await Promise.allSettled([
    deviceApi.getDevices(),
    issueApi.getIssues(),
    remediationApi.getRemediations(),
  ]);

  return {
    devices: devices.status === 'fulfilled' ? devices.value : [],
    issues: issues.status === 'fulfilled' ? issues.value : [],
    remediations: remediations.status === 'fulfilled' ? remediations.value : [],
  };
});

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.devices = action.payload.devices;
        state.issues = action.payload.issues;
        state.remediations = action.payload.remediations;
        state.loading = false;
      })
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load dashboard';
      });
  },
});

export default dashboardSlice.reducer;
