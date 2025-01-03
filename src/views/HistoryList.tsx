import * as React from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

import { MethodHistory } from './Models';

interface HistoryListProps {
    history: MethodHistory[];
    clickHandler: (h: MethodHistory, i: number) => void
}

export default function HistoryList({ history, clickHandler }: HistoryListProps) {
  return (
    <Box sx={{ width: '100%', maxWidth: 400, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
      <nav aria-label="commit history">
        <List>
          {history.map((h, index) => (
            <React.Fragment key={h.commit.hash}>
              <ListItem disablePadding>
                <ListItemButton sx={{ display: 'block', width: '100%' }} onClick={() => clickHandler(h, index)}>
                  <Box sx={{ padding: 2, width: '100%' }}>
                    {/* Commit Message: 大字体、加粗，超出一行时显示省略号 */}
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 'bold',
                        color: 'primary.main',
                        whiteSpace: 'nowrap', // 防止换行
                        overflow: 'hidden',   // 隐藏溢出的部分
                        textOverflow: 'ellipsis', // 显示省略号
                        display: 'block', // 保证在一行显示
                        width: '100%', // 限制宽度
                      }}
                    >
                      {h.commit.message}
                    </Typography>

                    {/* Commit Hash: 小字体，灰色，超出一行时显示省略号 */}
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        mt: 1,
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        display: 'block', 
                        width: '100%',
                      }}
                    >
                      hash: {h.commit.hash}
                    </Typography>

                    {/* Commit Author: 中等大小字体，超出一行时显示省略号 */}
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        mt: 0.5,
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        display: 'block', 
                        width: '100%',
                      }}
                    >
                      Author: {h.commit.authorName}
                    </Typography>
                  </Box>
                </ListItemButton>
              </ListItem>

              {/* Divider: 添加分隔线 */}
              {index < history.length - 1 && <Divider sx={{ marginY: 1 }} />}
            </React.Fragment>
          ))}
        </List>
      </nav>
    </Box>
  );
}