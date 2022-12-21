import React, { useRef, useState, useEffect } from "react";
import { Box } from '@strapi/design-system/Box';
import { Tabs, Tab, TabGroup, TabPanels, TabPanel } from '@strapi/design-system/Tabs';
import { Typography } from '@strapi/design-system';
import { Grid, GridItem } from '@strapi/design-system/Grid';
import { Flex } from '@strapi/design-system/Flex';
import { Button } from '@strapi/design-system/Button';

const PlatformsScreen = () => {

    return (
        <Box padding={8} background="neutral100">
            <TabGroup label="Some stuff for the label" id="tabs">
                <Tabs>
                    <Tab>Skroutz</Tab>
                    <Tab>Shopflix</Tab>
                    <Tab>Best Price</Tab>
                </Tabs>
                <TabPanels>
                    <TabPanel>
                        <Flex paddingTop={4} justifyContent="space-between">
                            <Button variant='secondary' label="ScrapCategories">Βρες τις κατηγορίες</Button>
                            <Button variant='secondary' label="Details">Αναλυτικά</Button>
                            <Button variant='primary' size="L" label="Scrap">
                            <Typography variant="beta bold">Scrap</Typography></Button>
                        </Flex>
                    </TabPanel>
                    <TabPanel>
                        Shopflix
                    </TabPanel>
                    <TabPanel>
                        Best Price
                    </TabPanel>
                </TabPanels>
            </TabGroup>
        </Box>
    )
}

export default PlatformsScreen;