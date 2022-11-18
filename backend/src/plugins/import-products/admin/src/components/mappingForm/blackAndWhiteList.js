import React, { memo, useContext, useEffect, useState } from 'react';
import { Box } from '@strapi/design-system/Box';
import { Tabs, Tab, TabGroup, TabPanels, TabPanel } from '@strapi/design-system/Tabs';
import { Radio, RadioGroup } from '@strapi/design-system/Radio';
import { Flex } from '@strapi/design-system/Flex';
import { Typography } from '@strapi/design-system/Typography';
import { Tooltip } from '@strapi/design-system/Tooltip';
import { Icon } from '@strapi/design-system/Icon';
import Information from '@strapi/icons/Information';
import MappingStock from './mappingStock';
import { MappingContext } from '../../pages/Mapping/mappingcontext';
import MappingWhitelist from './mappingWhitelist';
import MappingBlacklist from './mappingBlacklist';
import MappingXPath from './mappingXPath';
import MappingPrices from './mappingPrices';

const BlackAndWhiteList = ({ mapping }) => {

    const [importMapping, setImportMapping] = useContext(MappingContext)
    const [selected, setSelected] = useState(mapping.isWhitelistSelected);

    useEffect(() => {
        setImportMapping({ ...importMapping, isWhitelistSelected: selected })
    }, [selected]);

    return (
        <Box padding={4}>
            <Flex paddingBottom={2} justifyContent="space-between">
                <Box>
                    <Typography variant="pi" fontWeight="bold" textColor="neutral700">
                        Πληροφορίες
                    </Typography>
                    <Tooltip description="Στη λίστα whitelist αποθηκεύονται οι κατηγορίες που θέλουμε να εισάγουμε από το αρχείο του προμηθευτή.
                    Ενώ στη λίστα blacklist αποθηκεύονται οι κατηγορίες που θέλουμε να εξαιρέσουμε από το αρχείο του προμηθευτή.
                    Χρησιμοποιείται μόνο το ένα κάθε φορά.Επιλέξτε μία από τις δύο επιλογές. Η default επιλογή είναι η whitelist, η οποία αν είναι κενή
                    τότε θα εισαχθούν όλες οι κατηγορίες.
                    Όσον αφορά το Stock εκεί προσθέτουμε ποια επίπεδα θέλουμε να συμπεριληφθούν">
                        <button aria-label="Πληροφορίες για επιλέξιμες κατηγορίες"
                            style={{
                                border: 'none',
                                paddingLeft: 6,
                                background: 'transparent'
                            }}><Icon color="neutral500" aria-hidden={true} as={Information} />
                        </button>
                    </Tooltip>
                </Box>
                <Flex>
                    <Box paddingRight={4}>
                        <Typography variant="omega" id="included-categories">Επέλεξε Λίστα:</Typography>
                    </Box>
                    <RadioGroup labelledBy="included-categories" onChange={e => setSelected(e.target.value)} value={selected.toString()} name="importedLists">
                        <Radio value='true'>WhiteList</Radio>
                        <Radio value='false'>BlackList</Radio>
                    </RadioGroup>
                </Flex>
            </Flex>
            <TabGroup label="Some stuff for the label" id="tabs">
                <Tabs>
                    <Tab>WhiteList</Tab>
                    <Tab>BlackList</Tab>
                    <Tab>Stock</Tab>
                    <Tab>Όρια τιμών</Tab>
                    <Tab>XPath</Tab>
                </Tabs>
                <TabPanels>
                    <TabPanel>
                        <MappingWhitelist
                            label="Κατηγορία"
                            mapping={importMapping.whitelist_map}
                            categoryID={null} />
                    </TabPanel>
                    <TabPanel>
                        <MappingBlacklist
                            label="Κατηγορία"
                            mapping={importMapping.blacklist_map}
                            categoryID={null} />
                    </TabPanel>
                    <TabPanel>
                        <MappingStock />
                    </TabPanel>
                    <TabPanel>
                        <MappingPrices/>
                    </TabPanel>
                    <TabPanel>
                        <MappingXPath />
                    </TabPanel>
                </TabPanels>
            </TabGroup>
        </Box>
    )
}

export default BlackAndWhiteList