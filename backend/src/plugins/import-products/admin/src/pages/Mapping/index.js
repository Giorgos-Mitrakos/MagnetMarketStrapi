/*
 *
 * HomePage
 *
 */

import React, { memo, useEffect, useState } from 'react';
import { useParams } from "react-router-dom"
// import PropTypes from 'prop-types';
import pluginId from '../../pluginId';

import { Loader } from '@strapi/design-system/Loader';
import { Tabs, Tab, TabGroup, TabPanels, TabPanel } from '@strapi/design-system/Tabs';
import { Box } from '@strapi/design-system/Box';
import { Flex } from '@strapi/design-system/Flex';
import { Typography } from '@strapi/design-system/Typography';
import { Button } from '@strapi/design-system/Button';
import { Tooltip } from '@strapi/design-system/Tooltip';
import { Icon } from '@strapi/design-system/Icon';
import Information from '@strapi/icons/Information';
import { BaseHeaderLayout } from '@strapi/design-system/Layout';
import { getMapping, saveMapping, updateSpecs } from '../../utils/api';
import MappingForm from '../../components/mappingForm';
import { MappingContext } from './mappingcontext';
import MappingCharName from '../../components/mappingForm/mappingCharName';
import MappingCharValue from '../../components/mappingForm/mappingCharValue';
import BlackAndWhiteList from '../../components/mappingForm/blackAndWhiteList';



const Mapping = () => {

  const [importMapping, setImportMapping] = useState({});
  const [saving, setSaving] = useState(false);
  const [updateChars, setUpdateChars] = useState(false);
  const { id } = useParams()

  const fetchCategoryMapping = async () => {
    let map= await getMapping(id)
    console.log(map)
    setImportMapping(map); // Here
  };

  const handleSave = async () => {
    setSaving(true)
    await saveMapping(id, importMapping); // Here
    setSaving(false)
  };

  const handleUpdateChars =async () => {
    setUpdateChars(true)
    await updateSpecs(id)
    setUpdateChars(false)
  }

  useEffect(async () => {
    fetchCategoryMapping();
  }, []);

  return (
    <MappingContext.Provider value={[importMapping, setImportMapping]}>
      <Box background="neutral100">
        <BaseHeaderLayout
          title="Mapping"
          subtitle="Κάνε Mapping των Κατηγοριών και χαρακτηριστικών"
          as="h2"
          primaryAction={<Button onClick={() => handleSave()} loading={saving}>Save</Button>}
        />
      </Box>
      <Box paddingLeft={8} paddingRight={10} background="primary100">
        <Flex justifyContent="center" padding={6}>
          <Typography variant="beta" textColor="neutral700">{importMapping.name?.toUpperCase()}</Typography>
        </Flex>
        <TabGroup label="Some stuff for the label" id="tabs">
          <Tabs>
            <Tab>Κατηγορίες</Tab>
            <Tab>Χαρακτηριστικά</Tab>
            <Tab>Φίλτρα</Tab>
          </Tabs>
          <TabPanels>
            <TabPanel>
              <MappingForm label="Κατηγορία" mapping={importMapping.categories_map} categoryID={null} />
            </TabPanel>
            <TabPanel>
              <Box padding={4} paddingTop={6}>
                <Flex justifyContent="space-between">
                  <Box>
                    <Typography variant="pi" fontWeight="bold" textColor="neutral700">
                      Πληροφορίες
                    </Typography>
                    <Tooltip description="Στον τίτλο χαρακτηριστικού μπορούμε να κάνουμε αντιστοίχιση του
                  ονόματος του χαρακτηριστικού του αρχείου του προμηθευτή με το αντίστοιχο στη βάση μας 
                  (πχ.Proccessor-> Επεξεργαστής). Αντίστοιχα στην τιμή χαρακτηριστικού μπορούμε να κάνουμε
                  αντιστοίχιση στην τιμή του χαρακτηριστικού του προμηθευτή με το αντίστοιχο στη βάση μας
                  (πχ. Intel Core i3,2600Hz-> Core i3)">
                      <button aria-label="Πληροφορίες για χαρακτηριστικά"
                        style={{
                          border: 'none',
                          paddingLeft: 6,
                          background: 'transparent'
                        }}><Icon color="neutral500" aria-hidden={true} as={Information} />
                      </button>
                    </Tooltip>
                  </Box>
                  <Button variant='default' onClick={() => handleUpdateChars()}
                    loading={updateChars}>
                    Ενημέρωση χαρακτηριστικών
                  </Button>
                </Flex>
                <TabGroup label="Some stuff for the label" id="char_tabs">
                  <Tabs>
                    <Tab>Τίτλος Χαρακτηριστικού</Tab>
                    <Tab>Τιμή Χαρακτηριστικού</Tab>
                  </Tabs>
                  <TabPanels>
                    <TabPanel>
                      <MappingCharName mapping={importMapping.char_name_map} />
                    </TabPanel>
                    <TabPanel>
                      <MappingCharValue mapping={importMapping.char_value_map} />
                    </TabPanel>
                  </TabPanels>
                </TabGroup>
              </Box>
            </TabPanel>
            <TabPanel>
              <BlackAndWhiteList mapping={importMapping} />
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </Box>
    </MappingContext.Provider>
  );
};

export default memo(Mapping);