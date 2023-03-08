import React, { useRef, useState, useEffect } from "react";
import { Box } from '@strapi/design-system/Box';
import { Tabs, Tab, TabGroup, TabPanels, TabPanel } from '@strapi/design-system/Tabs';
import TransferLists from "./TransferLists";
import { getCategories } from "../../utils/api";

const Platforms = () => {

    const [allCategories, setAllCategories] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchCategories = async () => {
        setAllCategories(await getCategories()); // Here

        setIsLoading(false);
    };

    useEffect(async () => {
        fetchCategories();
    }, []);

    return (
        <Box padding={8} background="neutral100">
            <TabGroup label="Some stuff for the label" id="tabs">
                <Tabs>
                    <Tab>Skroutz</Tab>
                    <Tab>Shopflix</Tab>
                </Tabs>
                <TabPanels>
                    <TabPanel>
                        <TransferLists />
                    </TabPanel>
                    <TabPanel>
                        <TransferLists />
                    </TabPanel>
                </TabPanels>
            </TabGroup>
        </Box>

    )
}

export default Platforms