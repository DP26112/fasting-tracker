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
    // Local expansion state to lazy-render details only when expanded
    const [expanded, setExpanded] = React.useState(false);
    const handleChange = React.useCallback((_: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded);
    }, []);
    
    return (
        <Card raised sx={{ mb: 2, background: 'background.paper' }}>
            {/* 🔑 FINAL FIX: Using TransitionProps, the standard prop for inner transition components in many MUI elements. */}
            <Accordion
                disableGutters
                sx={{ background: 'transparent' }}
                TransitionProps={{ unmountOnExit: true }}
                expanded={expanded}
                onChange={handleChange}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ '& .MuiAccordionSummary-content': { margin: '12px 0' } }}
                    component="div"
                >
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 2, width: '100%' }}>
                        <Box sx={{ width: { xs: '100%', sm: '33%' } }}>
                            <Typography variant="h6" color="secondary.main">
                                {fast.durationHours.toFixed(2)} Hrs
                            </Typography>
                        </Box>
                        <Box sx={{ width: { xs: '100%', sm: '34%' } }}>
                            <Typography variant="body1" color="text.secondary">
                                {format(parseISO(fast.endTime), 'MMM d, yyyy')}
                            </Typography>
                        </Box>
                        <Box sx={{ width: { xs: '100%', sm: '33%' }, textAlign: 'right' }}>
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
                        </Box>
                    </Box>
                </AccordionSummary>

                {expanded && (
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
                                        
                                        const prefix = note.fastHours !== undefined
                                            ? `[${formatDuration(note.fastHours)}] ${format(noteTime, 'MMM d, h:mm a')}`
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
                )}
            </Accordion>
        </Card>
    );
});

export default FastHistoryItem;