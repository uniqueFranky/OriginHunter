import React from 'react';
import { Box, Typography, Divider, ListItem, ListItemText, ListItemButton } from '@mui/material';
import { MethodHistory, Commit } from './Models';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import DiffViewer from 'react-diff-viewer';


interface HistoryDetailProps {
  history: MethodHistory;
  previous: MethodHistory | undefined;
}

const HistoryDetail: React.FC<HistoryDetailProps> = ({ history, previous }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
      {/* Commit Message Section */}
      <Box sx={{ flex: 'none', marginBottom: '16px' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Commit Message
        </Typography>
        <Box
          sx={{
            maxHeight: '150px', // limit the height
            overflowY: 'auto',
            border: '1px solid #ddd',
            padding: '8px',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap', // Ensure new lines are preserved
            wordBreak: 'break-word', // Avoid words overflowing the container
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '14px' }}>
            {history.commit.message}
          </Typography>
        </Box>
      </Box>

      {/* Commit Hash and Author and Path */}
      <Box sx={{ flex: 'none', marginBottom: '16px' }}>
        <Typography variant="body2" sx={{ color: 'white' }}>
          <strong>Commit Hash:</strong> {history.commit.hash}
        </Typography>
        <Typography variant="body2" sx={{ color: 'white' }}>
          <strong>Author:</strong> {history.commit.authorName}
        </Typography>
        <Typography variant="body2" sx={{ color: 'white' }}>
          <strong>File:</strong> {history.container}
        </Typography>
      </Box>

      {/* Commit Code Section */}
      <Box sx={{ flex: '1', marginTop: '16px' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Commit Code
        </Typography>
        <Box
          sx={{
            maxHeight: '300px', // limit the height
            overflowY: 'auto',
            border: '1px solid #ddd',
            padding: '8px',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap', // Preserve code formatting
            wordBreak: 'break-word', // Avoid code lines overflowing
            backgroundColor: '#f5f5f5',
            fontFamily: 'monospace',
            fontSize: '14px',
          }}
        >
              {
              !previous &&
              <SyntaxHighlighter language="java" style={dark}>
              {history.code}
              </SyntaxHighlighter>
              }

              {
              previous &&
              <DiffViewer oldValue={previous!.code} newValue={history.code} splitView={true} />
              }
        </Box>
      </Box>
    </Box>
  );
};

export default HistoryDetail;
