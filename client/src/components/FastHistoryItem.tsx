import React from 'react';
import {
    Typography,
    Box,
    Card,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    List,
    ListItem,
    ListItemText,
    Grid,
    Divider,
    IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AccessTime, Event, Notes, WaterDrop, WbSunny } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import { format, parseISO } from 'date-fns';
import type { FastRecord, Note } from '../types';

interface FastHistoryItemProps {
    fast: FastRecord;
    onDelete: (event: React.MouseEvent, fastId: string) => void;
}

const FastHistoryItem: React.FC<FastHistoryItemProps> = React.memo(({ fast, onDelete }) => {
    const formatDuration = (hours: number): string => {
        const h = Math.floor(hours);
        const m = Math.round((hours % 1) * 60); 
        return `${h}h ${m}m`;
    };
    
    return (
        <Card raised sx={{ mb: 2, background: 'background.paper' }}>
            {/* 🔑 FINAL FIX: Using TransitionProps, the standard prop for inner transition components in many MUI elements. */}
            <Accordion
                disableGutters
                sx={{ background: 'transparent' }}
                TransitionProps={{ // This should correctly pass to the internal <Collapse> component.
                    unmountOnExit: true,
                }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ '& .MuiAccordionSummary-content': { margin: '12px 0' } }}
                    component="div"
                >
                    <Grid container spacing={2} alignItems="center">
                        <Grid grid={{ xs: 12, sm: 4 }}>
                            <Typography variant="h6" color="secondary.main">
                                {fast.durationHours.toFixed(2)} Hrs
                            </Typography>
                        </Grid>
                        <Grid grid={{ xs: 12, sm: 5 }}>
                            <Typography variant="body1" color="text.secondary">
                                {format(parseISO(fast.endTime), 'MMM d, yyyy')}
                            </Typography>
                        </Grid>
                        <Grid grid={{ xs: 12, sm: 3 }} sx={{ textAlign: 'right' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                <Typography variant="body2" sx={{ color: fast.fastType === 'dry' ? 'error.main' : 'info.main', whiteSpace: 'nowrap' }}>
                                    {fast.fastType.toUpperCase()}
                                    {fast.fastType === 'wet' ? <WaterDrop sx={{ fontSize: 16, ml: 0.5 }} /> : <WbSunny sx={{ fontSize: 16, ml: 0.5 }} />}
                                </Typography>
                                <IconButton
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onDelete(event, fast._id);
                                    }}
                                    color="error"
                                    size="small"
                                    sx={{ padding: '4px' }}
                                >
                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </Box>
                        </Grid>
                    </Grid>
                </AccordionSummary>

                <AccordionDetails sx={{ pt: 0, borderTop: '1px solid #333' }}>
                    <Box sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            <Event sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} /> Started: {format(parseISO(fast.startTime), 'MMM d, h:mm a')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            <AccessTime sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} /> Ended: {format(parseISO(fast.endTime), 'MMM d, h:mm a')}
                        </Typography>

                        {fast.notes && fast.notes.length > 0 && (
                            <>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="subtitle2" color="primary" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <Notes sx={{ fontSize: 18, mr: 0.5 }} /> Logged Notes:
                                </Typography>
                                <List dense disablePadding>
                                    {fast.notes.map((note: Note, index) => {
                                        const noteTime = parseISO(note.time);
                                        
                                        const prefix = note.duration !== undefined
                                            ? `[${formatDuration(note.duration)}] ${format(noteTime, 'MMM d, h:mm a')}`
                                            : `${format(noteTime, 'MMM d, h:mm a')}`;
                                            
                                        return (
                                            <ListItem key={index} disableGutters sx={{ py: 0 }}>
                                                <ListItemText
                                                    primary={`${prefix}: ${note.text}`}
                                                    primaryTypographyProps={{ variant: 'caption', color: 'text.primary' }}
                                                />
                                            </ListItem>
                                        );
                                    })}
                                </List>
                            </>
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Card>
    );
});

export default FastHistoryItem;