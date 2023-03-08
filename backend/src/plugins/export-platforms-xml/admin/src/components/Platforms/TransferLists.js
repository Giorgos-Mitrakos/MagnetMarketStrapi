import React, { useRef, useState, useEffect } from "react";
import { Box } from '@strapi/design-system/Box';
import { Grid, GridItem } from '@strapi/design-system';
import { Flex } from '@strapi/design-system';
import { Typography } from '@strapi/design-system';
import { Divider } from '@strapi/design-system';
import { IconButton } from '@strapi/design-system';
import ChevronLeft from '@strapi/icons/ChevronLeft';
import ChevronRight from '@strapi/icons/ChevronRight';
import { Checkbox } from '@strapi/design-system';

const TransferLists = () => {
    return (
        <Box paddingTop={8} background="neutral100">
            <Grid gap={2} padding={2}>
                <GridItem col={5} background="primary100">
                    <Box>
                        <Flex padding={4} direction="column" background="neutral0" shadow="filterShadow">
                            <Typography variant="delta" fontWeight="bold">Κατηγορίες</Typography>
                            <Typography variant="omega">0/100 Επιλέχθηκαν</Typography>
                            <Divider background="neutral900" paddingTop={2} paddingBottom={2} />

                        </Flex>
                    </Box>
                </GridItem>
                <GridItem col={2} background="primary100">
                    <Flex direction="column">
                        <IconButton label="Προσθήκη" icon={<ChevronRight />} />
                        <IconButton label="Αφαίρεση" icon={<ChevronLeft />} />
                    </Flex>
                </GridItem>
                <GridItem col={5} background="primary100">
                    <Flex padding={4} direction="column" background="neutral0" shadow="filterShadow">
                        <Typography variant="delta" fontWeight="bold">Κατηγορίες που θα εξαχθούν</Typography>
                        <Typography variant="omega">Επιλέχθηκαν</Typography>
                        <Divider paddingTop={2} paddingBottom={2} />
                    </Flex>
                </GridItem>
            </Grid>
        </Box>

    )
}

export default TransferLists