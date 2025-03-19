import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  SelectChangeEvent,
} from '@mui/material';

interface Trace {
  _id: string;
  trace_id: string;
  workflow_name: string;
  group_id: string | null;
  metadata: any;
  created_at: string;
}

const TraceList: React.FC = () => {
  const navigate = useNavigate();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('workflow_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchTraces = async () => {
    try {
      const response = await fetch(
        `https://traj-backend.onrender.com/api/traces?page=${page + 1}&limit=${rowsPerPage}`
      );
      const data = await response.json();
      setTraces(data.data || []);
      setTotalCount(data.pagination.total || 0);
    } catch (error) {
      console.error('Error fetching traces:', error);
    }
  };

  useEffect(() => {
    fetchTraces();
  }, [page, rowsPerPage, sortBy, sortOrder]);

  const handleChangePage = (event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleTraceClick = (traceId: string) => {
    navigate(`/trace/${traceId}`);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleSortByChange = (event: SelectChangeEvent) => {
    setSortBy(event.target.value);
  };

  const handleSortOrderChange = (event: SelectChangeEvent) => {
    setSortOrder(event.target.value as 'asc' | 'desc');
  };

  const filteredTraces = traces.filter((trace) =>
    trace.workflow_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Traces
      </Typography>
      
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <TextField
          label="Search by workflow name"
          variant="outlined"
          value={searchTerm}
          onChange={handleSearchChange}
          size="small"
        />
        
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Sort by</InputLabel>
          <Select
            value={sortBy}
            label="Sort by"
            onChange={handleSortByChange}
          >
            <MenuItem value="workflow_name">Workflow Name</MenuItem>
            <MenuItem value="id">Trace ID</MenuItem>
          </Select>
        </FormControl>
        
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Order</InputLabel>
          <Select
            value={sortOrder}
            label="Order"
            onChange={handleSortOrderChange}
          >
            <MenuItem value="asc">Ascending</MenuItem>
            <MenuItem value="desc">Descending</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Trace ID</TableCell>
              <TableCell>Workflow Name</TableCell>
              <TableCell>Group ID</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell>Metadata</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTraces.map((trace) => (
              <TableRow
                key={trace._id}
                onClick={() => handleTraceClick(trace.trace_id)}
                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#f5f5f5' } }}
              >
                <TableCell>{trace.trace_id}</TableCell>
                <TableCell>{trace.workflow_name}</TableCell>
                <TableCell>{trace.group_id || '-'}</TableCell>
                <TableCell>{new Date(trace.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {trace.metadata ? JSON.stringify(trace.metadata) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25]}
      />
    </Box>
  );
};

export default TraceList; 