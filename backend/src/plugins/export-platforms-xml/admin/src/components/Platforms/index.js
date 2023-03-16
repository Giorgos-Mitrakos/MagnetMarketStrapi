import React, { useRef, useState, useEffect } from "react";
import { Box } from '@strapi/design-system/Box';
import { Tabs, Tab, TabGroup, TabPanels, TabPanel } from '@strapi/design-system/Tabs';
import { Loader } from '@strapi/design-system';
import TransferLists from "./TransferLists";
import { getCategories, getPlatforms } from "../../utils/api";

const Platforms = () => {

    const [allCategories, setAllCategories] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [allPlatforms, setAllPlatforms] = useState({});

    const fetchCategories = async () => {
        setAllCategories(await getCategories()); // Here
        setAllPlatforms(await getPlatforms()); // Here

        setIsLoading(false);
    };
    useEffect(async () => {
        await fetchCategories();
    }, []);

    return (
        <Box padding={8} background="neutral100">
            {isLoading ? <Loader>Loading...</Loader> 
                : <TabGroup label="Some stuff for the label" id="tabs">
                    <Tabs>
                        {!isLoading && allPlatforms.map(platform =>
                            <Tab key={platform.id}>{platform.name}</Tab>
                        )}
                    </Tabs>
                    <TabPanels>
                        {!isLoading && allPlatforms.map(platform =>
                            <TabPanel key={platform.id}>
                                <TransferLists platformID={platform.id} categories={allCategories} categoriesExport={platform.export_categories} />
                            </TabPanel>
                        )}
                    </TabPanels>
                </TabGroup>}
        </Box>

    )
}

export default Platforms